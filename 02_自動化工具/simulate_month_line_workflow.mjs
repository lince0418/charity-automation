import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHEET_ID = "1GXGEDEoWd0EwYLKrR9Jx6lhubvtzP1SYkT8ZyAyQiCA";
const GID = "997862433";
const YEAR = 2026;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
const SNAPSHOT_PATH = path.join(ROOT, "02_自動化工具", "last_snapshot.json");
const IMAGE_TABLE = path.join(ROOT, "03_輸出與測試", "LINE圖片連結管理表.md");
const LOG_PATH = path.join(ROOT, "00_總覽與日誌", "SOP文檔工作日誌.md");
const ENV_PATH = path.join(ROOT, "02_自動化工具", "line_env.txt");
const monthNames = ["一月份", "二月份", "三月份", "四月份", "五月份", "六月份", "七月份", "八月份", "九月份", "十月份", "十一月份", "十二月份"];
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const targetMonth = Number(process.argv.find((arg) => arg.startsWith("--month="))?.split("=")[1] || "6");
const shouldSend = process.argv.includes("--send-test");
const shouldRefreshSheet = process.argv.includes("--refresh-sheet");

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else value += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value.trim());
      value = "";
    } else if (char === "\n") {
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") value += char;
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    rows.push(row);
  }
  return rows.filter((item) => item.some(Boolean));
}

function rowsToObjects(rows) {
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      if (header) item[header] = row[index] || "";
    });
    return item;
  });
}

function parseSheetDate(rawDate) {
  const match = String(rawDate || "").trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  return new Date(YEAR, Number(match[1]) - 1, Number(match[2]));
}

function formatDate(date, roc = false) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const prefix = roc ? `${YEAR - 1911}/` : "";
  return `${prefix}${month}/${day} (${weekdays[date.getDay()]})`;
}

function oneLine(value) {
  return String(value || "").replace(/\s*\n\s*/g, "、").trim();
}

function speakerLine(item) {
  return [oneLine(item["講師"]), oneLine(item["頭銜"])].filter(Boolean).join(" ");
}

function cleanTopic(topic) {
  return oneLine(topic).replace(/^成功人士專訪[:：]\s*/, "");
}

function monthlyPreview(items) {
  const labels = ["第一場", "第二場", "第三場", "第四場"];
  const events = items.map((item, index) => [
    `📅 ${labels[index] || `第${index + 1}場`}：${formatDate(item.date)}`,
    `💎 主題： ${cleanTopic(item["主題"])}`,
    `🎙️ 講師： ${speakerLine(item)}`,
  ].join("\n")).join("\n\n");
  return [
    `【${YEAR} ․ ${targetMonth}月份】線上公益講座預告 🚀`,
    "",
    "社團法人中華國際NLP教練研究發展教育協會，秉持著推廣專業教練技術、回饋社會的初衷，每個月與您相約雲端，開啟思維轉化的新契機！",
    "",
    "本月我們為您準備了以下精彩內容：",
    "",
    events,
    "",
    "✨ 期待大家支持公益、一起學習成長！",
  ].join("\n");
}

function previewText(item) {
  if (item["類別"] === "成功人士") {
    return [
      "🫴本日線上公益講座已經上線，邀請大家一起來聆聽。",
      "",
      "🪷歡迎分享給身邊的親朋好友",
      "",
      "🔗https://www.facebook.com/inlpca",
      "",
      `💎 成功人士專訪: ${cleanTopic(item["主題"])}`,
      `🎙️ 講師： ${speakerLine(item)}`,
      "",
      "✨期待大家支持公益、一起學習成長。",
    ].join("\n");
  }
  return [
    "社團法人中華國際NLP教練研究發展教育協會～～線上公益講座活動預告",
    "",
    `🤳 日期： ${formatDate(item.date, true)}`,
    `💎 主題： ${cleanTopic(item["主題"])}`,
    `🎙️ 講師： ${speakerLine(item)}`,
    "",
    "✨期待大家支持公益、一起學習成長。",
  ].join("\n");
}

function publishText(item) {
  return [
    "🫴本日線上公益講座已經上線，邀請大家一起來聆聽。",
    "",
    "🪷歡迎分享給身邊的親朋好友",
    "",
    "🔗https://www.facebook.com/inlpca",
    "",
    `💎 主題： ${cleanTopic(item["主題"])}`,
    `🎙️ 講師： ${speakerLine(item)}`,
    "",
    "✨期待大家支持公益、一起學習成長。",
  ].join("\n");
}

async function imageLinksByDate() {
  const links = new Map();
  const monthLinks = new Map();
  try {
    const markdown = await fs.readFile(IMAGE_TABLE, "utf8");
    for (const line of markdown.split(/\r?\n/)) {
      const columns = line.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (columns.length < 5) continue;
      const date = columns[0];
      const monthLabel = columns[0];
      const type = columns[1] || "";
      const candidateUrl = (columns[3] || "").replace(/`/g, "");
      const formalUrl = (columns[4] || "").replace(/`/g, "");
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(date) && formalUrl?.startsWith("https://")) {
        links.set(date, formalUrl);
      }
      if (/^\d{4}\/\d{2}$/.test(date) && type.includes("月預告") && formalUrl?.startsWith("https://")) {
        const month = Number(date.split("/")[1]);
        monthLinks.set(month, formalUrl);
      }
      if (monthLabel === monthNames[targetMonth - 1] && type.includes("月預告") && candidateUrl?.startsWith("https://")) {
        monthLinks.set(targetMonth, candidateUrl);
      }
    }
  } catch {}
  return { links, monthLinks };
}

function dateKey(date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

async function sendLine(text, imageUrl) {
  const env = await readEnvFile(ENV_PATH);
  const messages = [{ type: "text", text }];
  if (imageUrl) {
    messages.push({ type: "image", originalContentUrl: imageUrl, previewImageUrl: imageUrl });
  }
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: env.LINE_TO_ID, messages }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
}

async function readEnvFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return Object.fromEntries(content.split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
  }));
}

async function appendLog(lines) {
  const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
  await fs.appendFile(LOG_PATH, [`## ${timestamp}`, "", ...lines, ""].join("\n"), "utf8");
}

async function readRows() {
  if (shouldRefreshSheet) {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error(`Google 試算表讀取失敗：HTTP ${response.status}`);
    return rowsToObjects(parseCsv(await response.text()));
  }

  const snapshot = JSON.parse(await fs.readFile(SNAPSHOT_PATH, "utf8"));
  return Object.values(snapshot);
}

const rows = (await readRows())
  .map((item) => ({ ...item, date: parseSheetDate(item["日期"]) }))
  .filter((item) => item.date && item.date.getMonth() + 1 === targetMonth)
  .sort((a, b) => a.date - b.date);

const { links, monthLinks } = await imageLinksByDate();
const monthDir = path.join(ROOT, "協會演講", `${YEAR}年`, monthNames[targetMonth - 1], "待發送包");
await fs.mkdir(monthDir, { recursive: true });

const tasks = [
  { kind: "月預告", file: `${YEAR}-${String(targetMonth).padStart(2, "0")}_月預告.md`, text: monthlyPreview(rows), imageUrl: monthLinks.get(targetMonth) || "" },
];

for (const item of rows) {
  const key = dateKey(item.date);
  const prefix = `${YEAR}-${String(targetMonth).padStart(2, "0")}-${String(item.date.getDate()).padStart(2, "0")}_${item["類別"]}`;
  tasks.push({ kind: `${item["類別"]}預告`, file: `${prefix}_預告.md`, text: previewText(item), imageUrl: links.get(key) || "" });
  tasks.push({ kind: "上線日通知", file: `${prefix}_上線日通知.md`, text: publishText(item), imageUrl: links.get(key) || "" });
}

const reportRows = [];
for (const task of tasks) {
  const filePath = path.join(monthDir, task.file);
  await fs.writeFile(filePath, task.text, "utf8");
  if (shouldSend) await sendLine(`[${targetMonth}月自動化模擬]\n${task.kind}\n\n${task.text}`, task.imageUrl);
  reportRows.push(`| ${task.kind} | ${task.file} | ${task.imageUrl ? "有圖片網址" : "缺圖片網址"} | ${shouldSend ? "已送到測試群組" : "未送出，僅模擬"} |`);
}

const report = [
  `# ${YEAR} 年 ${targetMonth} 月 LINE 自動化模擬報告`,
  "",
  `- 模式：${shouldSend ? "送到 LINE 測試群組" : "乾跑，不送 LINE"}`,
  `- 資料來源：${shouldRefreshSheet ? "即時讀取 Google 試算表" : "本機快照，避免重複讀取雲端"}`,
  `- 活動筆數：${rows.length}`,
  `- 待發送任務：${tasks.length}`,
  `- 待發送包：${path.relative(ROOT, monthDir)}`,
  "",
  "| 文案類型 | 文字檔 | 圖片狀態 | 發送狀態 |",
  "|---|---|---|---|",
  ...reportRows,
  "",
  "## 判斷",
  "",
  tasks.every((task) => task.imageUrl || task.kind === "月預告")
    ? "- 單場活動圖片網址齊全。"
    : "- 有活動缺少圖片網址，正式發送前需補上 Google Drive 公開圖片連結。",
].join("\n");

await fs.writeFile(path.join(monthDir, `${YEAR}-${String(targetMonth).padStart(2, "0")}_LINE自動化模擬報告.md`), report, "utf8");
await appendLog([
  `- 已完成 ${YEAR} 年 ${targetMonth} 月 LINE 自動化${shouldSend ? "送出測試" : "乾跑模擬"}。`,
  `- 活動筆數：${rows.length}。`,
  `- 待發送任務：${tasks.length}。`,
  `- 待發送包位置：協會演講/${YEAR}年/${monthNames[targetMonth - 1]}/待發送包。`,
]);

console.log(report);
