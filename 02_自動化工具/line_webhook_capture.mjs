import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.LINE_WEBHOOK_PORT || 8787);
const secret = process.env.LINE_CHANNEL_SECRET || "";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logPath = path.join(root, "00_總覽與日誌", "LINE官方帳號測試日誌.md");

function verifySignature(body, signature) {
  if (!secret) return { ok: true, note: "未設定 LINE_CHANNEL_SECRET，略過簽章驗證。" };
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
  return {
    ok: expected === signature,
    note: expected === signature ? "簽章驗證通過。" : "簽章驗證失敗。",
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function sourceSummary(source = {}) {
  if (source.type === "user") return `userId=${source.userId}`;
  if (source.type === "group") return `groupId=${source.groupId}; userId=${source.userId || "無"}`;
  if (source.type === "room") return `roomId=${source.roomId}; userId=${source.userId || "無"}`;
  return JSON.stringify(source);
}

async function appendLog(lines) {
  const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
  try {
    await fs.access(logPath);
  } catch {
    await fs.writeFile(logPath, "# LINE 官方帳號測試日誌\n\n", "utf8");
  }
  await fs.appendFile(logPath, [`## ${now}`, "", ...lines, ""].join("\n"), "utf8");
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("LINE webhook capture is running.\n");
    return;
  }

  if (request.method !== "POST" || request.url !== "/webhook") {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const body = await readBody(request);
  const signature = request.headers["x-line-signature"] || "";
  const verify = verifySignature(body, signature);
  const payload = JSON.parse(body.toString("utf8") || "{}");
  const lines = [
    `- 收到 LINE webhook：${payload.events?.length || 0} 筆事件。`,
    `- ${verify.note}`,
  ];

  for (const event of payload.events || []) {
    lines.push(`- event.type=${event.type}; source.type=${event.source?.type}; ${sourceSummary(event.source)}`);
    if (event.message?.type === "text") lines.push(`- message.text=${event.message.text}`);
  }

  await appendLog(lines);
  console.log(lines.join("\n"));

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: verify.ok }));
});

server.listen(port, () => {
  console.log(`LINE webhook capture is running at http://localhost:${port}/webhook`);
  console.log("需要用 ngrok 或其他 HTTPS tunnel 對外公開這個網址，才能填到 LINE Developers Webhook URL。");
});
