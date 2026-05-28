import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, "02_自動化工具", "line_env.txt");
const fileEnv = await readEnvFile(envPath);

const token = fileEnv.LINE_CHANNEL_ACCESS_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN;
const to = fileEnv.LINE_TO_ID || process.env.LINE_TO_ID;
const textFile = process.argv[2] || "";
const imageUrl = process.argv[3] || "";

if (!token || !to) {
  console.error("請先設定 line_env.txt 內的 LINE_CHANNEL_ACCESS_TOKEN 與 LINE_TO_ID。");
  process.exit(1);
}

if (!textFile) {
  console.error("請提供要發送的文字檔路徑。");
  console.error("用法：node 02_自動化工具/line_send_from_file.mjs 文字檔.md 圖片網址");
  process.exit(1);
}

const text = (await fs.readFile(path.resolve(root, textFile), "utf8")).trim();
const messages = [{ type: "text", text }];

if (imageUrl) {
  messages.push({
    type: "image",
    originalContentUrl: imageUrl,
    previewImageUrl: imageUrl,
  });
}

const response = await fetch("https://api.line.me/v2/bot/message/push", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ to, messages }),
});

if (!response.ok) {
  const errorText = await response.text();
  console.error(`LINE 發送失敗：HTTP ${response.status}`);
  console.error(errorText);
  process.exit(1);
}

console.log("LINE 圖文訊息已送出。");

async function readEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          if (index === -1) return [line, ""];
          const key = line.slice(0, index).trim();
          const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
          return [key, value];
        }),
    );
  } catch {
    return {};
  }
}
