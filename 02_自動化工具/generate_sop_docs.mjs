import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHEET_ID = "1GXGEDEoWd0EwYLKrR9Jx6lhubvtzP1SYkT8ZyAyQiCA";
const GID = "997862433";
const YEAR = 2026;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YEAR_DIR = path.join(ROOT, "協會演講", `${YEAR}年`);
const SNAPSHOT_PATH = path.join(ROOT, "02_自動化工具", "last_snapshot.json");
const LOG_PATH = path.join(ROOT, "00_總覽與日誌", "SOP文檔工作日誌.md");
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

const monthNames = [
  "一月份",
  "二月份",
  "三月份",
  "四月份",
  "五月份",
  "六月份",
  "七月份",
  "八月份",
  "九月份",
  "十月份",
  "十一月份",
  "十二月份",
];

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const orderLabels = ["第一場", "第二場", "第三場", "第四場", "第五場"];

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
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value.trim());
      value = "";
    } else if (char === "\n") {
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    rows.push(row);
  }

  return rows.filter((item) => item.some(Boolean));
}

function normalizeHeaders(headers) {
  return headers.map((header) => header.trim());
}

function rowsToObjects(rows) {
  const headers = normalizeHeaders(rows[0]);
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
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(YEAR, month - 1, day);
}

function formatDate(date, style = "western") {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const week = weekdays[date.getDay()];
  if (style === "roc") return `${YEAR - 1911}/${month}/${day} (${week})`;
  return `${month}/${day} (${week})`;
}

function speakerLine(item) {
  return [item["講師"], item["頭銜"]].filter(Boolean).join(" ");
}

function monthNumber(date) {
  return date.getMonth() + 1;
}

function isComplete(item) {
  return Boolean(item.date && item["講師"] && item["主題"]);
}

function cleanTopic(topic) {
  return topic.replace(/^成功人士專訪[:：]\s*/, "").trim();
}

function successTopic(topic) {
  return `成功人士專訪: ${cleanTopic(topic)}`;
}

function oneLine(value) {
  return String(value || "").replace(/\s*\n\s*/g, "、").trim();
}

function monthlyPreview(month, items) {
  const title = `【${YEAR} ․ ${month}月份】線上公益講座預告 🚀`;
  const eventBlocks = items
    .map((item, index) => {
      const label = orderLabels[index] || `第${index + 1}場`;
      return [
        `📅 ${label}：${formatDate(item.date)}`,
        `💎 主題： ${cleanTopic(item["主題"])}`,
        `🎙️ 講師： ${speakerLine(item)}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    title,
    "",
    "社團法人中華國際NLP教練研究發展教育協會，秉持著推廣專業教練技術、回饋社會的初衷，每個月與您相約雲端，開啟思維轉化的新契機！",
    "",
    "本月我們為您準備了以下精彩內容：",
    "",
    eventBlocks,
    "",
    "✨ 期待大家支持公益、一起學習成長！",
  ].join("\n");
}

function coachPreview(item) {
  return [
    "社團法人中華國際NLP教練研究發展教育協會～～線上公益講座活動預告",
    "",
    `🤳 日期： ${formatDate(item.date, "roc")}`,
    `💎 主題： ${cleanTopic(item["主題"])}`,
    `🎙️ 講師： ${speakerLine(item)}`,
    "",
    "✨期待大家支持公益、一起學習成長。",
  ].join("\n");
}

function successPreview(item) {
  return [
    "🫴本日線上公益講座已經上線，邀請大家一起來聆聽。",
    "",
    "🪷歡迎分享給身邊的親朋好友",
    "",
    "🔗https://www.facebook.com/inlpca",
    "",
    `💎 ${successTopic(item["主題"])}`,
    `🎙️ 講師： ${speakerLine(item)}`,
    "",
    "✨期待大家支持公益、一起學習成長。",
  ].join("\n");
}

function publishNotice(item) {
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

function eventFileSection(item) {
  const titleDate = `${YEAR}-${String(monthNumber(item.date)).padStart(2, "0")}-${String(item.date.getDate()).padStart(2, "0")}`;
  const sections = [];

  if (item["類別"] === "教練講座") {
    sections.push(["## 教練講座預告", coachPreview(item)].join("\n\n"));
  }

  if (item["類別"] === "成功人士") {
    sections.push(["## 成功人士預告", successPreview(item)].join("\n\n"));
  }

  sections.push(["## 上線日通知", publishNotice(item)].join("\n\n"));

  return [`# ${titleDate} ${item["類別"] || "線上公益講座"}文案`, "", ...sections].join("\n\n");
}

async function readSnapshot() {
  try {
    return JSON.parse(await fs.readFile(SNAPSHOT_PATH, "utf8"));
  } catch {
    return {};
  }
}

function snapshotKey(item) {
  return `${item["日期"]}|${item["類別"]}|${item["講師"]}`;
}

function snapshotValue(item) {
  return {
    日期: item["日期"],
    類別: item["類別"],
    講師: item["講師"],
    頭銜: item["頭銜"],
    主題: item["主題"],
  };
}

function hasChanged(previous, current) {
  return JSON.stringify(previous) !== JSON.stringify(current);
}

async function appendLog(lines) {
  const now = new Date();
  const timestamp = now.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
  const entry = [`## ${timestamp}`, "", ...lines, ""].join("\n");

  try {
    await fs.access(LOG_PATH);
  } catch {
    await fs.writeFile(LOG_PATH, "# SOP文檔工作日誌\n\n", "utf8");
  }

  await fs.appendFile(LOG_PATH, entry, "utf8");
}

async function main() {
  const response = await fetch(SHEET_CSV_URL);
  if (!response.ok) throw new Error(`無法讀取 Google 試算表：HTTP ${response.status}`);

  const csv = await response.text();
  const sheetRows = rowsToObjects(parseCsv(csv));
  const items = sheetRows
    .map((item) => ({ ...item, date: parseSheetDate(item["日期"]) }))
    .filter((item) => item.date)
    .sort((a, b) => a.date - b.date);

  const completeItems = items.filter(isComplete);
  const incompleteItems = items.filter((item) => item.date && !isComplete(item));
  const previousSnapshot = await readSnapshot();
  const nextSnapshot = {};
  const changedItems = [];

  for (const item of completeItems) {
    const key = snapshotKey(item);
    const value = snapshotValue(item);
    nextSnapshot[key] = value;
    if (hasChanged(previousSnapshot[key], value)) changedItems.push(item);
  }

  const byMonth = new Map();
  for (const item of completeItems) {
    const month = monthNumber(item.date);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(item);
  }

  let generatedFileCount = 0;
  for (const [month, monthItems] of byMonth) {
    const monthDir = path.join(YEAR_DIR, monthNames[month - 1]);
    await fs.mkdir(monthDir, { recursive: true });

    const monthDoc = [
      "# 自動產生文案",
      "",
      "## 月預告",
      "",
      monthlyPreview(month, monthItems),
      "",
      "---",
      "",
      ...monthItems.map(eventFileSection),
      "",
    ].join("\n");

    await fs.writeFile(path.join(monthDir, "自動產生文案.md"), monthDoc, "utf8");
    generatedFileCount += 1;
  }

  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(nextSnapshot, null, 2), "utf8");

  const logLines = [
    `- 已讀取 Google 試算表資料列：${items.length} 筆。`,
    `- 日期、主題、講師皆完整，可產生文案：${completeItems.length} 筆。`,
    `- 因日期、主題或講師未齊全，暫不產生文案：${incompleteItems.length} 筆。`,
    `- 本次產生或更新月份文案檔：${generatedFileCount} 份。`,
    `- 偵測到新增或變更的完整資料：${changedItems.length} 筆。`,
  ];

  if (changedItems.length > 0) {
    logLines.push("- 變更項目：");
    for (const item of changedItems) {
      logLines.push(`  - ${item["日期"]}｜${item["類別"]}｜${oneLine(item["講師"])}｜${oneLine(item["主題"])}`);
    }
  }

  await appendLog(logLines);

  console.log(logLines.join("\n"));
}

main().catch(async (error) => {
  await appendLog([`- 執行失敗：${error.message}`]);
  console.error(error);
  process.exitCode = 1;
});
