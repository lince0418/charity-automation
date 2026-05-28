import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHEET_ID = "1GXGEDEoWd0EwYLKrR9Jx6lhubvtzP1SYkT8ZyAyQiCA";
const GID = "997862433";
const SHEET_NAME = "雙周講師SOP";
const YEAR = 2026;
const OWNER = "孔星元";
const COMPLETED_BEFORE_MONTH = 6;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE_TABLE_PATH = path.join(ROOT, "03_輸出與測試", "LINE圖片連結管理表.md");
const OUTPUT_PATH = path.join(ROOT, "00_總覽與日誌", "2026線上公益講座一頁式進度儀表板.html");
const DATA_PATH = path.join(ROOT, "00_總覽與日誌", "2026線上公益講座儀表板資料.json");
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
const shouldRefreshSheet = process.argv.includes("--refresh-sheet");
const requiredColumns = ["日期", "類別", "講師", "頭銜", "主題"];

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
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function oneLine(value) {
  return String(value || "").replace(/\s*\n\s*/g, "、").trim();
}

function cleanTopic(topic) {
  return oneLine(topic).replace(/^成功人士專訪[:：]\s*/, "").trim();
}

function statusLabel(kind, text) {
  return { kind, text };
}

async function readRows() {
  if (!shouldRefreshSheet) {
    throw new Error("年度儀表板必須即時讀取 Google 試算表「雙周講師SOP」。請使用 --refresh-sheet。");
  }

  const response = await fetch(SHEET_CSV_URL);
  if (!response.ok) {
    throw new Error(`Google 試算表「${SHEET_NAME}」CSV 讀取失敗：HTTP ${response.status}。這通常代表試算表不是公開 CSV，請改用 Apps Script 授權版 HTML 儀表板。`);
  }

  return {
    rows: rowsToObjects(parseCsv(await response.text())),
    sourceLabel: `即時讀取 Google 試算表「${SHEET_NAME}」`,
    sourceWarning: "",
  };
}

function validateRows(rows) {
  const columns = new Set();
  for (const row of rows) {
    Object.keys(row).forEach((key) => columns.add(key));
  }

  const missingColumns = requiredColumns.filter((column) => !columns.has(column));
  const completeRows = rows.filter((row) => {
    const parsed = parseSheetDate(row["日期"]);
    return parsed && oneLine(row["講師"]) && cleanTopic(row["主題"]);
  });

  return {
    missingColumns,
    completeRows: completeRows.length,
    totalRows: rows.length,
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const nextPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) files.push(...await listFiles(nextPath));
      else files.push(nextPath);
    }
    return files;
  } catch {
    return [];
  }
}

async function readImageTable() {
  const byMonth = new Map();
  const byDate = new Map();
  try {
    const markdown = await fs.readFile(IMAGE_TABLE_PATH, "utf8");
    for (const line of markdown.split(/\r?\n/)) {
      const columns = line.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (columns.length < 5) continue;
      const date = columns[0];
      const type = columns[1] || "";
      const status = columns.at(-1) || "";
      const url = columns.find((cell) => cell.includes("https://")) || "";
      if (/^2026\/\d{2}$/.test(date)) {
        const month = Number(date.split("/")[1]);
        byMonth.set(month, { type, status, hasUrl: url.includes("https://") });
      }
      if (/^2026\/\d{2}\/\d{2}$/.test(date)) {
        byDate.set(date, { type, status, hasUrl: url.includes("https://") });
      }
    }
  } catch {}
  return { byMonth, byDate };
}

function groupRowsByMonth(rows) {
  const months = new Map();
  for (let month = 1; month <= 12; month += 1) months.set(month, []);

  for (const row of rows) {
    const parsed = parseSheetDate(row["日期"]);
    if (!parsed) continue;
    months.get(parsed.month).push({
      date: `${YEAR}/${pad(parsed.month)}/${pad(parsed.day)}`,
      month: parsed.month,
      day: parsed.day,
      type: oneLine(row["類別"]),
      speaker: oneLine(row["講師"]),
      title: oneLine(row["頭銜"]),
      topic: cleanTopic(row["主題"]),
    });
  }

  for (const items of months.values()) {
    items.sort((a, b) => a.day - b.day);
  }

  return months;
}

function summarizeTopics(events) {
  if (events.length === 0) return `「${SHEET_NAME}」目前尚未建立本月講座資料`;
  return events.map((event) => `${event.type || "講座"}：${event.topic || "主題待補"}`).join("<br>");
}

function summarizeSpeakers(events) {
  if (events.length === 0) return `講師與頭銜待「${SHEET_NAME}」補齊`;
  return events.map((event) => {
    const speaker = event.speaker || "講師待補";
    const title = event.title ? `：${event.title}` : "：頭銜待補";
    return `${speaker}${title}`;
  }).join("<br>");
}

function detectMonthImages(month, events, imageIndex, localFiles) {
  const imageExt = /\.(png|jpe?g|webp)$/i;
  const monthFiles = localFiles.filter((file) => imageExt.test(file));
  const eventImageCount = events.filter((event) => imageIndex.byDate.get(event.date)?.hasUrl).length;
  const hasMonthPreviewUrl = Boolean(imageIndex.byMonth.get(month)?.hasUrl);
  const needed = events.length + (events.length > 0 ? 1 : 0);
  const found = eventImageCount + (hasMonthPreviewUrl ? 1 : 0);

  if (month < COMPLETED_BEFORE_MONTH) return statusLabel("done", "已完成：圖片與發送素材完成");
  if (needed > 0 && found >= needed) return statusLabel("done", "已完成：圖片網址齊全");
  if (monthFiles.length > 0 || found > 0) return statusLabel("review", `部分完成：本機 ${monthFiles.length} 個圖片檔，圖片網址 ${found}/${needed}`);
  if (events.length === 0) return statusLabel("empty", "尚未排定講座資料");
  return statusLabel("risk", "待補：尚未確認圖片或公開圖片網址");
}

function detectCopyStatus(month, events, monthDir, files) {
  const hasAutoDoc = files.some((file) => path.basename(file) === "自動產生文案.md");
  const packageFiles = files.filter((file) => file.includes(`${path.sep}待發送包${path.sep}`) && file.endsWith(".md"));

  if (month < COMPLETED_BEFORE_MONTH) return statusLabel("done", "已完成：文案、發送、上架完成");
  if (events.length === 0) return statusLabel("empty", "尚未排定講座資料");
  if (packageFiles.length >= events.length * 2 + 1) return statusLabel("done", "已完成：月預告、預告文、上線日通知");
  if (hasAutoDoc) return statusLabel("review", "已產生月文案，待整理待發送包");
  if (monthDir) return statusLabel("risk", "待產生文案");
  return statusLabel("empty", "尚未建立月份資料夾");
}

function sendingStatus(month, events, copyStatus) {
  if (month < COMPLETED_BEFORE_MONTH) return statusLabel("done", "已完成：正式發送完成");
  if (events.length === 0) return statusLabel("empty", "尚未排程");
  if (month === COMPLETED_BEFORE_MONTH && copyStatus.kind === "done") {
    return statusLabel("review", "待正式群組排程與發送");
  }
  return statusLabel("review", "待排程");
}

function publishStatus(month, events, copyStatus) {
  if (month < COMPLETED_BEFORE_MONTH) return statusLabel("done", "已完成：上架完成");
  if (events.length === 0) return statusLabel("empty", "尚未排程");
  if (month === COMPLETED_BEFORE_MONTH && copyStatus.kind === "done") {
    return statusLabel("review", "待上線日確認影片或連結");
  }
  return statusLabel("review", "待上架確認");
}

function exceptionText(month, imageStatus, copyStatus, events) {
  if (month < COMPLETED_BEFORE_MONTH) return "目前無異常紀錄";
  const issues = [];
  if (events.length === 0) issues.push(`「${SHEET_NAME}」尚未建立本月資料`);
  if (imageStatus.kind === "risk") issues.push("圖片網址待確認或可能缺漏");
  if (copyStatus.kind === "risk") issues.push("文案待產生或待整理");
  return issues.length ? issues.join("；") : "目前無異常紀錄";
}

function currentIsoTaipei() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderStatus(status) {
  return `<span class="pill ${status.kind}">${escapeHtml(status.text)}</span>`;
}

function renderHtml(data) {
  const rows = data.months.map((month) => `
            <tr>
              <td class="month-cell">${month.monthLabel}</td>
              <td>${renderStatus(month.imageStatus)}</td>
              <td>${month.topics}</td>
              <td>${month.speakers}</td>
              <td>${renderStatus(month.copyStatus)}</td>
              <td>${renderStatus(month.sendingStatus)}</td>
              <td>${renderStatus(month.publishStatus)}</td>
              <td>${escapeHtml(month.owner)}</td>
              <td>${escapeHtml(month.exception)}</td>
            </tr>`).join("");

  const detailCards = data.months.map((month) => `
          <article class="month-card">
            <div class="month-card-head">
              <strong>${month.monthLabel}</strong>
              ${renderStatus(month.overallStatus)}
            </div>
            <p>${month.events.length ? month.events.map((event) => `${event.date} ${event.type}｜${event.speaker}`).join("<br>") : `本月尚無「${SHEET_NAME}」講座資料`}</p>
          </article>`).join("");

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${YEAR} 線上公益講座年度進度儀表板</title>
  <style>
    :root {
      --ink: #1f2933;
      --muted: #64748b;
      --line: #d8e0ea;
      --paper: #f6f8fb;
      --panel: #ffffff;
      --blue: #2563a8;
      --blue-soft: #e4f0ff;
      --green: #28754e;
      --green-soft: #def4e6;
      --amber: #a86512;
      --amber-soft: #fff1cc;
      --red: #b42318;
      --red-soft: #ffe4e1;
      --gray-soft: #eef2f7;
      --shadow: 0 18px 40px rgba(31, 41, 51, .09);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--paper);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Microsoft JhengHei", sans-serif;
      line-height: 1.55;
    }
    .page { width: min(1500px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 44px; }
    .topbar { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
    .brand { display: flex; gap: 12px; align-items: center; min-width: 0; }
    .mark { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px; background: var(--blue); color: #fff; font-weight: 900; flex: 0 0 auto; }
    .eyebrow { margin: 0; color: var(--muted); font-size: 13px; font-weight: 800; }
    h1 { margin: 2px 0 0; font-size: clamp(25px, 2.3vw, 38px); line-height: 1.16; letter-spacing: 0; }
    h2 { margin: 0; font-size: 20px; line-height: 1.25; letter-spacing: 0; }
    button {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: var(--ink);
      padding: 10px 14px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    button:hover { border-color: var(--blue); }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 16px;
      margin-bottom: 16px;
      align-items: stretch;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
      padding: 18px;
    }
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 13px; background: #fbfdff; }
    .metric span { display: block; color: var(--muted); font-size: 13px; font-weight: 800; }
    .metric strong { display: block; margin-top: 4px; font-size: 28px; line-height: 1.2; }
    .progress-wrap { margin-top: 14px; }
    .progress-meta { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 13px; font-weight: 800; margin-bottom: 8px; }
    .progress { height: 13px; overflow: hidden; border-radius: 999px; background: #e7edf4; }
    .bar { height: 100%; width: ${data.summary.progressPercent}%; background: linear-gradient(90deg, var(--green), #38a169, var(--blue)); }
    .note-list { display: grid; gap: 10px; margin-top: 0; }
    .note { border-left: 4px solid var(--blue); border-radius: 8px; background: var(--blue-soft); padding: 10px 12px; font-size: 14px; }
    .note.warning { border-color: var(--amber); background: var(--amber-soft); }
    .section { margin-top: 16px; }
    .section-lead { margin: 5px 0 0; color: var(--muted); font-size: 14px; }
    .table-scroll { overflow-x: auto; margin-top: 14px; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; min-width: 1280px; border-collapse: collapse; background: #fff; }
    th, td { padding: 12px 13px; border-bottom: 1px solid var(--line); vertical-align: top; text-align: left; font-size: 14px; }
    th { position: sticky; top: 0; z-index: 1; color: #fff; background: #243b53; font-weight: 850; white-space: nowrap; }
    tr:last-child td { border-bottom: 0; }
    tbody tr:nth-child(even) td { background: #fbfdff; }
    .month-cell { font-weight: 900; white-space: nowrap; }
    .pill { display: inline-flex; min-height: 26px; align-items: center; padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 900; }
    .pill.done { color: var(--green); background: var(--green-soft); }
    .pill.review { color: var(--amber); background: var(--amber-soft); }
    .pill.risk { color: var(--red); background: var(--red-soft); }
    .pill.empty { color: var(--muted); background: var(--gray-soft); }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .month-card { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; }
    .month-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
    .month-card p { margin: 0; color: var(--muted); font-size: 13px; }
    .footer { margin-top: 16px; color: var(--muted); font-size: 13px; text-align: right; }
    @media (max-width: 1120px) {
      .hero { grid-template-columns: 1fr; }
      .summary-grid, .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .page { width: min(100% - 20px, 1500px); padding-top: 14px; }
      .topbar { flex-direction: column; }
      button { width: 100%; }
      .summary-grid, .cards { grid-template-columns: 1fr; }
      .panel { padding: 15px; }
    }
    @media print {
      body { background: #fff; }
      .page { width: 100%; padding: 0; }
      button { display: none; }
      .panel { box-shadow: none; break-inside: avoid; }
      th { background: #e9eef4 !important; color: #111827 !important; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="topbar">
      <div class="brand">
        <div class="mark">IN</div>
        <div>
          <p class="eyebrow">社團法人中華國際NLP教練研究發展教育協會｜公益活動組</p>
          <h1>${YEAR} 線上公益講座年度進度儀表板</h1>
        </div>
      </div>
      <button type="button" onclick="window.print()">列印 / 轉 PDF</button>
    </header>

    <section class="hero">
      <div class="panel">
        <p class="eyebrow">最後更新：${escapeHtml(data.generatedAt)}｜資料來源：${escapeHtml(data.sourceLabel)}</p>
        <h2>年度總覽</h2>
        <p class="section-lead">以 Google 試算表「${SHEET_NAME}」為核心資料來源，搭配圖片連結表、月份文案與待發送包自動整理。6 月以前已依指示設定為發送完成、上架完成。</p>
        <div class="summary-grid">
          <div class="metric"><span>已完成月份</span><strong>${data.summary.completedMonths} / 12</strong></div>
          <div class="metric"><span>雙周講師SOP 場次</span><strong>${data.summary.eventCount}</strong></div>
          <div class="metric"><span>需追蹤月份</span><strong>${data.summary.reviewMonths}</strong></div>
          <div class="metric"><span>發送負責人</span><strong>${OWNER}</strong></div>
        </div>
        <p class="section-lead">資料檢查：共 ${data.validation.totalRows} 筆，日期、講師、主題完整 ${data.validation.completeRows} 筆，必要欄位${data.validation.missingColumns.length ? `缺少 ${escapeHtml(data.validation.missingColumns.join("、"))}` : "齊全"}。</p>
        <div class="progress-wrap">
          <div class="progress-meta"><span>年度完成率</span><span>${data.summary.progressPercent}%</span></div>
          <div class="progress"><div class="bar"></div></div>
        </div>
      </div>
      <aside class="panel">
        <h2>管理規則</h2>
        <div class="note-list">
          <div class="note">發送負責人固定為：${OWNER}。</div>
          <div class="note">1-5 月發送與上架已完成，直接列為完成。</div>
          <div class="note warning">異常紀錄用來追蹤圖片網址失效、群組未收到、文案需重改等問題。</div>
          ${data.sourceWarning ? `<div class="note warning">${escapeHtml(data.sourceWarning)}</div>` : ""}
        </div>
      </aside>
    </section>

    <section class="panel section">
      <h2>全年月份進度表</h2>
      <p class="section-lead">每次重跑產生器都會依「${SHEET_NAME}」重建這張表，全年 12 個月都會保留。</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>月份</th>
              <th>圖片進度</th>
              <th>講座主題</th>
              <th>講師頭銜</th>
              <th>文案完成</th>
              <th>發送狀態</th>
              <th>上架狀態</th>
              <th>發送負責人</th>
              <th>異常紀錄</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel section">
      <h2>月份明細</h2>
      <p class="section-lead">快速查看各月份在「${SHEET_NAME}」中已建立的日期、類別與講師。</p>
      <div class="cards">${detailCards}
      </div>
    </section>

    <p class="footer">自動產生檔案：02_自動化工具/generate_dashboard.mjs｜資料輸出：00_總覽與日誌/2026線上公益講座儀表板資料.json</p>
  </main>
</body>
</html>`;
}

async function main() {
  const readResult = await readRows();
  const rows = readResult.rows;
  const validation = validateRows(rows);
  const grouped = groupRowsByMonth(rows);
  const imageIndex = await readImageTable();
  const months = [];

  for (let month = 1; month <= 12; month += 1) {
    const monthDir = path.join(ROOT, "協會演講", `${YEAR}年`, monthNames[month - 1]);
    const files = await listFiles(monthDir);
    const events = grouped.get(month) || [];
    const imageStatus = detectMonthImages(month, events, imageIndex, files);
    const copyStatus = detectCopyStatus(month, events, monthDir, files);
    const sendStatus = sendingStatus(month, events, copyStatus);
    const uploadStatus = publishStatus(month, events, copyStatus);
    const overallStatus = month < COMPLETED_BEFORE_MONTH
      ? statusLabel("done", "完成")
      : events.length === 0
        ? statusLabel("empty", "未排定")
        : copyStatus.kind === "done" && imageStatus.kind === "done"
          ? statusLabel("review", "待發送/上架")
          : statusLabel("risk", "待補強");

    months.push({
      month,
      monthLabel: `${month} 月`,
      folder: await pathExists(monthDir) ? path.relative(ROOT, monthDir) : "",
      events,
      topics: summarizeTopics(events),
      speakers: summarizeSpeakers(events),
      imageStatus,
      copyStatus,
      sendingStatus: sendStatus,
      publishStatus: uploadStatus,
      owner: OWNER,
      exception: exceptionText(month, imageStatus, copyStatus, events),
      overallStatus,
    });
  }

  const completedMonths = months.filter((month) => month.overallStatus.kind === "done").length;
  const reviewMonths = months.filter((month) => month.month >= COMPLETED_BEFORE_MONTH).length;
  const data = {
    generatedAt: currentIsoTaipei(),
    sourceLabel: readResult.sourceLabel,
    sourceWarning: readResult.sourceWarning,
    rules: {
      sheetId: SHEET_ID,
      gid: GID,
      sheetName: SHEET_NAME,
      owner: OWNER,
      completedBeforeMonth: COMPLETED_BEFORE_MONTH,
      exceptionField: "圖片網址失效、群組未收到、文案需重改等問題",
    },
    validation,
    summary: {
      completedMonths,
      reviewMonths,
      eventCount: months.reduce((sum, month) => sum + month.events.length, 0),
      progressPercent: Math.round((completedMonths / 12) * 100),
    },
    months,
  };

  if (validation.missingColumns.length > 0) {
    data.sourceWarning = [
      data.sourceWarning,
      `「${SHEET_NAME}」缺少必要欄位：${validation.missingColumns.join("、")}`,
    ].filter(Boolean).join("；");
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  await fs.writeFile(OUTPUT_PATH, renderHtml(data), "utf8");
  console.log(`已更新年度儀表板：${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(`已更新資料輸出：${path.relative(ROOT, DATA_PATH)}`);
  if (readResult.sourceWarning) console.log(readResult.sourceWarning);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
