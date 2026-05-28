import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "line_env.txt");
const fileEnv = await readEnvFile(envPath);

const token = fileEnv.LINE_CHANNEL_ACCESS_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN;
const to = fileEnv.LINE_TO_ID || process.env.LINE_TO_ID;
const text = fileEnv.LINE_TEST_TEXT || process.env.LINE_TEST_TEXT || "公益講座 LINE 官方帳號測試訊息：如果你看到這則訊息，代表文字推播成功。";
const imageUrl = fileEnv.LINE_IMAGE_URL || process.env.LINE_IMAGE_URL;

if (!token || !to) {
  console.error("請先設定 LINE_CHANNEL_ACCESS_TOKEN 與 LINE_TO_ID。");
  process.exit(1);
}

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

console.log("LINE 測試訊息已送出。");

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
