import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHEET_ID = "1GXGEDEoWd0EwYLKrR9Jx6lhubvtzP1SYkT8ZyAyQiCA";
const GID = "997862433";
const YEAR = 2026;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "03_輸出與測試", "Google日曆提醒");
const OUTPUT_ICS = path.join(OUTPUT_DIR, "線上公益講座_LINE發送提醒.ics");
const OUTPUT_MD = path.join(OUTPUT_DIR, "Google日曆匯入說明.md");
const LOG_PATH = path.join(ROOT, "00_總覽與日誌", "SOP文檔工作日誌.md");
const SNAPSHOT_PATH = path.join(ROOT, "02_自動化工具", "last_snapshot.json");
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
const CANVA_URL = "https://canva.link/cp96smnjxg00aid";
const FACEBOOK_URL = "https://www.facebook.com/inlpca";
const now = new Date();
const CURRENT_DATE = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const shouldRefreshSheet = process.argv.includes("--refresh-sheet");
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

function dateAt(date, hour, minute = 0) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
}

function mondayOfWeek(date) {
  const copy = new Date(date);
  const diff = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0);
}

function formatDisplayDate(date) {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}（${weekdays[date.getDay()]}）`;
}

function formatIcsDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    pad(date.getMinutes()),
    "00",
  ].join("");
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function cleanText(value, fallback = "") {
  return String(value || fallback).replace(/\s*\n\s*/g, "、").trim();
}

function escapeIcs(value) {
  return cleanText(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function eventUid(prefix, date, suffix) {
  return `${prefix}-${formatIcsDate(date)}-${suffix}@inlpca-public-lecture`;
}

function makeEvent({ uid, title, start, description }) {
  const end = addMinutes(start, 30);
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART;TZID=Asia/Taipei:${formatIcsDate(start)}`,
    `DTEND;TZID=Asia/Taipei:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(title)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT5M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(title)}`,
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n");
}

async function appendLog(lines) {
  const now = new Date();
  const timestamp = now.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
  await fs.appendFile(LOG_PATH, [`## ${timestamp}`, "", ...lines, ""].join("\n"), "utf8");
}

async function main() {
  const sourceRows = await readRows();

  const rows = sourceRows
    .map((item) => ({ ...item, date: parseSheetDate(item["日期"]) }))
    .filter((item) => item.date && item.date >= CURRENT_DATE)
    .sort((a, b) => a.date - b.date);

  const events = [];
  const months = new Map();

  for (const item of rows) {
    const month = item.date.getMonth() + 1;
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(item);

    const topic = cleanText(item["主題"], "待補主題");
    const speaker = cleanText(item["講師"], "待補講師");
    const category = cleanText(item["類別"], "線上公益講座");
    const folderMonth = monthNames[month - 1];
    const baseDescription = [
      `活動日期：${formatDisplayDate(item.date)}`,
      `文案類型：${category}`,
      `講師：${speaker}`,
      `主題：${topic}`,
      `Canva：${CANVA_URL}`,
      `Facebook：${FACEBOOK_URL}`,
        `資料夾：協會演講/${YEAR}年/${folderMonth}`,
      "請確認：文字、圖片文宣、LINE 社群身份或頭銜。",
    ].join("\n");

    const monday = dateAt(mondayOfWeek(item.date), 18);
    if (monday >= CURRENT_DATE) {
      events.push(makeEvent({
        uid: eventUid("weekly-preview", monday, `${month}-${item.date.getDate()}-${speaker}`),
        title: `LINE 發送：${category}預告｜${formatDisplayDate(item.date)}｜${speaker}`,
        start: monday,
        description: `${baseDescription}\n\n任務：今天 18:00 發送當週預告文字與圖片。`,
      }));
    }

    const publishDay = dateAt(item.date, 19);
    if (publishDay >= CURRENT_DATE) {
      events.push(makeEvent({
        uid: eventUid("publish-day", publishDay, `${month}-${item.date.getDate()}-${speaker}`),
        title: `LINE 發送：上線日通知｜${formatDisplayDate(item.date)}｜${speaker}`,
        start: publishDay,
        description: `${baseDescription}\n\n任務：今天 19:00 發送上線日通知文字與圖片。`,
      }));
    }
  }

  for (const [month, items] of months) {
    const previousMonthIndex = month - 2;
    const reminderDate = dateAt(lastDayOfMonth(YEAR, previousMonthIndex), 19);
    if (reminderDate < CURRENT_DATE) continue;
    const speakers = items.map((item) => cleanText(item["講師"], "待補講師")).join("、");
    const topics = items.map((item) => cleanText(item["主題"], "待補主題")).join("；");
    events.push(makeEvent({
      uid: eventUid("monthly-preview", reminderDate, `${month}`),
      title: `LINE 發送：${month}月月預告`,
      start: reminderDate,
      description: [
        `任務：今天 19:00 發送 ${month} 月月預告文字與圖片。`,
        `講師：${speakers}`,
        `主題：${topics}`,
        `Canva：${CANVA_URL}`,
        `資料夾：協會演講/${YEAR}年/${monthNames[month - 1]}`,
        "請確認：月預告圖、月預告文字、LINE 社群身份或頭銜。",
      ].join("\n"),
    }));
  }

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//INLPCA//Public Lecture LINE Reminder//ZH-TW",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:線上公益講座 LINE 發送提醒",
    "X-WR-TIMEZONE:Asia/Taipei",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Taipei",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_ICS, `${calendar}\r\n`, "utf8");

  const guide = [
    "# Google 日曆匯入說明",
    "",
    "## 匯入檔案",
    "",
    "`線上公益講座_LINE發送提醒.ics`",
    "",
    "## 匯入步驟",
    "",
    "1. 打開 Google 日曆網頁版。",
    "2. 左側找到「其他日曆」。",
    "3. 點選「+」。",
    "4. 選擇「匯入」。",
    "5. 選擇本資料夾中的 `.ics` 檔。",
    "6. 建議匯入到一個新日曆，名稱可設為「線上公益講座 LINE 發送提醒」。",
    "7. 確認手機 Google 日曆 App 已開啟此日曆通知。",
    "",
    "## 提醒內容",
    "",
    "- 每則提醒會在發送時間前 30 分鐘與前 5 分鐘提醒。",
    "- 提醒包含 Canva 連結、月份資料夾、講師、主題與發送任務。",
    "- 若試算表主題尚未填寫，事件會標示 `待補主題`。",
    "- 預設使用本機快照，避免重複讀取雲端；需要更新時才加上 `--refresh-sheet`。",
    "",
    "## 本次產生範圍",
    "",
    `- 資料來源：${shouldRefreshSheet ? "即時讀取 Google 試算表" : "本機快照"}`,
    `- 活動資料列：${rows.length} 筆`,
    `- 日曆提醒事件：${events.length} 筆`,
  ].join("\n");
  await fs.writeFile(OUTPUT_MD, guide, "utf8");

  await appendLog([
    "- 已產生 Google 日曆匯入檔。",
    `- 資料來源：${shouldRefreshSheet ? "即時讀取 Google 試算表" : "本機快照"}。`,
    `- 活動資料列：${rows.length} 筆。`,
    `- 日曆提醒事件：${events.length} 筆。`,
    "- 提醒規則：月底 19:00 月預告、當週星期一 18:00 預告、活動當天 19:00 上線日通知。",
    "- 每則提醒包含 30 分鐘前與 5 分鐘前通知。",
  ]);

  console.log(`已產生：${OUTPUT_ICS}`);
  console.log(`提醒事件：${events.length}`);
}

async function readRows() {
  if (shouldRefreshSheet) {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error(`無法讀取 Google 試算表：HTTP ${response.status}`);
    return rowsToObjects(parseCsv(await response.text()));
  }

  const snapshot = JSON.parse(await fs.readFile(SNAPSHOT_PATH, "utf8"));
  return Object.values(snapshot);
}

main().catch(async (error) => {
  await appendLog([`- Google 日曆提醒檔產生失敗：${error.message}`]);
  console.error(error);
  process.exitCode = 1;
});
