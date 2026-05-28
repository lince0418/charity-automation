const DASHBOARD_CONFIG = {
  spreadsheetId: "1GXGEDEoWd0EwYLKrR9Jx6lhubvtzP1SYkT8ZyAyQiCA",
  sheetName: "雙周講師SOP",
  year: 2026,
  owner: "孔星元",
  completedBeforeMonth: 6,
  requiredHeaders: ["日期", "類別", "講師", "頭銜", "主題"],
};

function doGet() {
  const data = buildDashboardData_();
  const html = renderDashboardHtml_(data);
  return HtmlService.createHtmlOutput(html)
    .setTitle(`${DASHBOARD_CONFIG.year} 線上公益講座年度進度儀表板`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function buildDashboardData_() {
  const sheet = SpreadsheetApp.openById(DASHBOARD_CONFIG.spreadsheetId).getSheetByName(DASHBOARD_CONFIG.sheetName);
  if (!sheet) throw new Error(`找不到分頁：${DASHBOARD_CONFIG.sheetName}`);

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map((header) => String(header || "").trim());
  const rows = values.slice(1)
    .map((row) => rowToObject_(headers, row))
    .filter((row) => row["日期"]);
  const missingHeaders = DASHBOARD_CONFIG.requiredHeaders.filter((header) => !headers.includes(header));
  const months = buildMonths_(rows);
  const completedMonths = months.filter((month) => month.overallStatus.kind === "done").length;

  return {
    generatedAt: Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss"),
    sheetName: DASHBOARD_CONFIG.sheetName,
    owner: DASHBOARD_CONFIG.owner,
    missingHeaders,
    totalRows: rows.length,
    completeRows: rows.filter((row) => parseMonthDay_(row["日期"]) && clean_(row["講師"]) && clean_(row["主題"])).length,
    completedMonths,
    trackingMonths: months.filter((month) => month.month >= DASHBOARD_CONFIG.completedBeforeMonth).length,
    eventCount: rows.filter((row) => parseMonthDay_(row["日期"])).length,
    progressPercent: Math.round((completedMonths / 12) * 100),
    months,
  };
}

function rowToObject_(headers, row) {
  return headers.reduce((item, header, index) => {
    if (header) item[header] = row[index] || "";
    return item;
  }, {});
}

function buildMonths_(rows) {
  const grouped = {};
  for (let month = 1; month <= 12; month += 1) grouped[month] = [];

  rows.forEach((row) => {
    const parsed = parseMonthDay_(row["日期"]);
    if (!parsed) return;
    grouped[parsed.month].push({
      date: `${DASHBOARD_CONFIG.year}/${pad_(parsed.month)}/${pad_(parsed.day)}`,
      month: parsed.month,
      day: parsed.day,
      type: clean_(row["類別"]),
      speaker: clean_(row["講師"]),
      title: clean_(row["頭銜"]),
      topic: cleanTopic_(row["主題"]),
      dataReady: bool_(row["資料確認"]),
      monthImage: clean_(row["月圖完成"]),
      speakerImage: clean_(row["講師圖完成"]),
      promoReady: bool_(row["宣傳圖確認"]),
      videoReady: bool_(row["影片確認"]),
      publishDate: clean_(row["當天發布連結"]),
      certificate: clean_(row["感謝狀"]),
      payment: clean_(row["車馬費"]),
      allDone: bool_(row["全部完成"]),
      member: clean_(row["是否為會員"]),
      note: clean_(row["備註"]),
    });
  });

  return Object.keys(grouped).map((monthKey) => {
    const month = Number(monthKey);
    const events = grouped[month].sort((a, b) => a.day - b.day);
    const imageStatus = imageStatus_(month, events);
    const copyStatus = copyStatus_(month, events);
    const sendingStatus = sendingStatus_(month, events);
    const publishStatus = publishStatus_(month, events);
    const exception = exceptionText_(month, events, imageStatus, copyStatus);
    const overallStatus = overallStatus_(month, events);

    return {
      month,
      monthLabel: `${month} 月`,
      events,
      topics: topics_(events),
      speakers: speakers_(events),
      imageStatus,
      copyStatus,
      sendingStatus,
      publishStatus,
      owner: DASHBOARD_CONFIG.owner,
      exception,
      overallStatus,
    };
  });
}

function parseMonthDay_(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

function clean_(value) {
  return String(value || "").replace(/\s*\n\s*/g, "、").trim();
}

function cleanTopic_(value) {
  return clean_(value).replace(/^成功人士專訪[:：]\s*/, "").trim();
}

function bool_(value) {
  const text = clean_(value).toUpperCase();
  return text === "TRUE" || text === "已完成";
}

function pad_(value) {
  return String(value).padStart(2, "0");
}

function label_(kind, text) {
  return { kind, text };
}

function imageStatus_(month, events) {
  if (month < DASHBOARD_CONFIG.completedBeforeMonth) return label_("done", "已完成");
  if (!events.length) return label_("empty", "尚未排定");
  if (events.every((event) => event.monthImage && event.speakerImage && event.promoReady)) return label_("done", "圖片進度完成");
  if (events.some((event) => event.monthImage || event.speakerImage || event.promoReady)) return label_("review", "圖片進行中");
  return label_("risk", "圖片待補");
}

function copyStatus_(month, events) {
  if (month < DASHBOARD_CONFIG.completedBeforeMonth) return label_("done", "已完成");
  if (!events.length) return label_("empty", "尚未排定");
  if (events.every((event) => event.topic)) return label_("done", "文案可製作");
  return label_("risk", "主題或文案資料待補");
}

function sendingStatus_(month, events) {
  if (month < DASHBOARD_CONFIG.completedBeforeMonth) return label_("done", "正式發送完成");
  if (!events.length) return label_("empty", "尚未排程");
  if (events.every((event) => event.allDone)) return label_("done", "全部完成");
  return label_("review", "待正式發送/追蹤");
}

function publishStatus_(month, events) {
  if (month < DASHBOARD_CONFIG.completedBeforeMonth) return label_("done", "上架完成");
  if (!events.length) return label_("empty", "尚未排程");
  if (events.every((event) => event.videoReady && event.publishDate)) return label_("done", "上架節點已排定");
  return label_("review", "待影片確認或上架");
}

function exceptionText_(month, events, imageStatus, copyStatus) {
  if (month < DASHBOARD_CONFIG.completedBeforeMonth) return "目前無異常紀錄";
  const issues = [];
  if (!events.length) issues.push("本月尚未排定講座");
  events.forEach((event) => {
    if (!event.topic) issues.push(`${event.date} ${event.speaker || "講師待補"}：主題待補`);
    if (!event.title) issues.push(`${event.date} ${event.speaker || "講師待補"}：頭銜待補`);
    if (!event.videoReady) issues.push(`${event.date} ${event.speaker || "講師待補"}：影片待確認`);
  });
  if (imageStatus.kind === "risk") issues.push("圖片網址或圖片進度待確認");
  if (copyStatus.kind === "risk") issues.push("文案需重改或資料待補");
  return issues.length ? issues.join("；") : "目前無異常紀錄";
}

function overallStatus_(month, events) {
  if (month < DASHBOARD_CONFIG.completedBeforeMonth) return label_("done", "完成");
  if (!events.length) return label_("empty", "未排定");
  if (events.every((event) => event.allDone)) return label_("done", "完成");
  return label_("review", "追蹤中");
}

function topics_(events) {
  if (!events.length) return "尚未排定";
  return events.map((event) => `${event.type || "講座"}：${event.topic || "主題待補"}`).join("<br>");
}

function speakers_(events) {
  if (!events.length) return "尚未排定";
  return events.map((event) => `${event.speaker || "講師待補"}${event.title ? `：${event.title}` : "：頭銜待補"}`).join("<br>");
}

function pill_(status) {
  return `<span class="pill ${status.kind}">${escape_(status.text)}</span>`;
}

function escape_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderDashboardHtml_(data) {
  const rows = data.months.map((month) => `
            <tr>
              <td class="month">${month.monthLabel}</td>
              <td>${pill_(month.imageStatus)}</td>
              <td>${month.topics}</td>
              <td>${month.speakers}</td>
              <td>${pill_(month.copyStatus)}</td>
              <td>${pill_(month.sendingStatus)}</td>
              <td>${pill_(month.publishStatus)}</td>
              <td>${escape_(month.owner)}</td>
              <td>${escape_(month.exception)}</td>
            </tr>`).join("");

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${DASHBOARD_CONFIG.year} 線上公益講座年度進度儀表板</title>
  <style>
    :root{--ink:#1f2933;--muted:#64748b;--line:#d8e0ea;--paper:#f6f8fb;--panel:#fff;--blue:#2563a8;--green:#28754e;--amber:#a86512;--red:#b42318}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC","Microsoft JhengHei",sans-serif;line-height:1.55}
    .page{width:min(1500px,calc(100% - 32px));margin:0 auto;padding:24px 0 44px}.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}
    h1{margin:0;font-size:clamp(25px,2.3vw,38px);line-height:1.16}.eyebrow{margin:0 0 4px;color:var(--muted);font-size:13px;font-weight:800}
    .panel{border:1px solid var(--line);border-radius:8px;background:var(--panel);box-shadow:0 18px 40px rgba(31,41,51,.09);padding:18px;margin-top:16px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:14px}
    .metric{border:1px solid var(--line);border-radius:8px;padding:13px;background:#fbfdff}.metric span{display:block;color:var(--muted);font-size:13px;font-weight:800}.metric strong{display:block;margin-top:4px;font-size:28px}
    .progress{height:13px;overflow:hidden;border-radius:999px;background:#e7edf4;margin-top:12px}.bar{height:100%;width:${data.progressPercent}%;background:linear-gradient(90deg,var(--green),#38a169,var(--blue))}
    .table-wrap{overflow-x:auto;margin-top:14px;border:1px solid var(--line);border-radius:8px}table{width:100%;min-width:1280px;border-collapse:collapse;background:#fff}th,td{padding:12px 13px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;font-size:14px}th{position:sticky;top:0;color:#fff;background:#243b53;font-weight:850;white-space:nowrap}.month{font-weight:900;white-space:nowrap}
    .pill{display:inline-flex;min-height:26px;align-items:center;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:900}.done{color:var(--green);background:#def4e6}.review{color:var(--amber);background:#fff1cc}.risk{color:var(--red);background:#ffe4e1}.empty{color:var(--muted);background:#eef2f7}
    button{border:1px solid var(--line);border-radius:8px;background:#fff;padding:10px 14px;font:inherit;font-weight:800;cursor:pointer}@media(max-width:900px){.top{flex-direction:column}.grid{grid-template-columns:1fr 1fr}}@media(max-width:640px){.page{width:min(100% - 20px,1500px)}.grid{grid-template-columns:1fr}button{width:100%}}
  </style>
</head>
<body>
  <main class="page">
    <header class="top">
      <div>
        <p class="eyebrow">社團法人中華國際NLP教練研究發展教育協會｜公益活動組</p>
        <h1>${DASHBOARD_CONFIG.year} 線上公益講座年度進度儀表板</h1>
      </div>
      <button onclick="window.print()">列印 / 轉 PDF</button>
    </header>
    <section class="panel">
      <p class="eyebrow">最後更新：${escape_(data.generatedAt)}｜核心資料來源：Google 試算表「${escape_(data.sheetName)}」</p>
      <div class="grid">
        <div class="metric"><span>已完成月份</span><strong>${data.completedMonths} / 12</strong></div>
        <div class="metric"><span>追蹤月份</span><strong>${data.trackingMonths}</strong></div>
        <div class="metric"><span>講座場次</span><strong>${data.eventCount}</strong></div>
        <div class="metric"><span>發送負責人</span><strong>${escape_(data.owner)}</strong></div>
      </div>
      <p>資料檢查：共 ${data.totalRows} 筆，日期、講師、主題完整 ${data.completeRows} 筆，必要欄位${data.missingHeaders.length ? `缺少 ${escape_(data.missingHeaders.join("、"))}` : "齊全"}。</p>
      <div class="progress"><div class="bar"></div></div>
    </section>
    <section class="panel">
      <h2>全年月份進度表</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>月份</th><th>圖片進度</th><th>講座主題</th><th>講師頭銜</th><th>文案完成</th><th>發送狀態</th><th>上架狀態</th><th>發送負責人</th><th>異常紀錄</th></tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`;
}
