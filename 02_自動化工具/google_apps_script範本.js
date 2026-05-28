const CONFIG = {
  year: 2026,
  sourceSheetName: "工作表1",
  outputSheetName: "自動產生文案",
  logSheetName: "SOP文檔工作日誌",
  facebookUrl: "https://www.facebook.com/inlpca",
};

function checkAndGenerateLectureDocs() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = spreadsheet.getSheetByName(CONFIG.sourceSheetName) || spreadsheet.getSheets()[0];
  const outputSheet = getOrCreateSheet_(spreadsheet, CONFIG.outputSheetName);
  const logSheet = getOrCreateSheet_(spreadsheet, CONFIG.logSheetName);
  const values = sourceSheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const rows = values.slice(1).map((row) => rowToObject_(headers, row));
  const completeRows = rows
    .map(normalizeRow_)
    .filter((row) => row.date && row["日期"] && row["主題"] && row["講師"])
    .sort((a, b) => a.date - b.date);

  const output = [["月份", "日期", "類別", "講師", "主題", "文案類型", "文案"]];
  const monthGroups = groupByMonth_(completeRows);

  Object.keys(monthGroups).forEach((month) => {
    output.push([month, "", "", "", "", "月預告", monthlyPreview_(Number(month), monthGroups[month])]);

    monthGroups[month].forEach((row) => {
      if (row["類別"] === "教練講座") {
        output.push([month, row["日期"], row["類別"], row["講師"], row["主題"], "教練講座預告", coachPreview_(row)]);
      }

      if (row["類別"] === "成功人士") {
        output.push([month, row["日期"], row["類別"], row["講師"], row["主題"], "成功人士預告", successPreview_(row)]);
      }

      output.push([month, row["日期"], row["類別"], row["講師"], row["主題"], "上線日通知", publishNotice_(row)]);
    });
  });

  outputSheet.clearContents();
  outputSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
  outputSheet.autoResizeColumns(1, output[0].length);

  logSheet.appendRow([
    new Date(),
    `已檢查 ${rows.length} 筆資料；符合日期、主題、講師完整條件 ${completeRows.length} 筆；已更新文案輸出表。`,
  ]);
}

function createTwiceDailyTriggers() {
  ScriptApp.newTrigger("checkAndGenerateLectureDocs")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  ScriptApp.newTrigger("checkAndGenerateLectureDocs")
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();
}

function rowToObject_(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index];
    return object;
  }, {});
}

function normalizeRow_(row) {
  const date = parseDate_(row["日期"]);
  return {
    ...row,
    date,
    "日期": row["日期"] ? String(row["日期"]).trim() : "",
    "類別": row["類別"] ? String(row["類別"]).trim() : "",
    "講師": row["講師"] ? String(row["講師"]).trim() : "",
    "頭銜": row["頭銜"] ? String(row["頭銜"]).trim() : "",
    "主題": row["主題"] ? String(row["主題"]).trim() : "",
  };
}

function parseDate_(value) {
  if (value instanceof Date) return value;
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  return new Date(CONFIG.year, Number(match[1]) - 1, Number(match[2]));
}

function groupByMonth_(rows) {
  return rows.reduce((groups, row) => {
    const month = row.date.getMonth() + 1;
    groups[month] = groups[month] || [];
    groups[month].push(row);
    return groups;
  }, {});
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function formatDate_(date, roc) {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const prefix = roc ? `${CONFIG.year - 1911}/` : "";
  return `${prefix}${month}/${day} (${weekdays[date.getDay()]})`;
}

function speakerLine_(row) {
  return [row["講師"], row["頭銜"]].filter(Boolean).join(" ");
}

function cleanTopic_(topic) {
  return String(topic || "").replace(/^成功人士專訪[:：]\s*/, "").trim();
}

function successTopic_(topic) {
  return `成功人士專訪: ${cleanTopic_(topic)}`;
}

function monthlyPreview_(month, rows) {
  const labels = ["第一場", "第二場", "第三場", "第四場"];
  const events = rows.map((row, index) => [
    `📅 ${labels[index] || `第${index + 1}場`}：${formatDate_(row.date, false)}`,
    `💎 主題： ${cleanTopic_(row["主題"])}`,
    `🎙️ 講師： ${speakerLine_(row)}`,
  ].join("\n")).join("\n\n");

  return [
    `【${CONFIG.year} ․ ${month}月份】線上公益講座預告 🚀`,
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

function coachPreview_(row) {
  return [
    "社團法人中華國際NLP教練研究發展教育協會～～線上公益講座活動預告",
    "",
    `🤳 日期： ${formatDate_(row.date, true)}`,
    `💎 主題： ${cleanTopic_(row["主題"])}`,
    `🎙️ 講師： ${speakerLine_(row)}`,
    "",
    "✨期待大家支持公益、一起學習成長。",
  ].join("\n");
}

function successPreview_(row) {
  return [
    "🫴本日線上公益講座已經上線，邀請大家一起來聆聽。",
    "",
    "🪷歡迎分享給身邊的親朋好友",
    "",
    `🔗${CONFIG.facebookUrl}`,
    "",
    `💎 ${successTopic_(row["主題"])}`,
    `🎙️ 講師： ${speakerLine_(row)}`,
    "",
    "✨期待大家支持公益、一起學習成長。",
  ].join("\n");
}

function publishNotice_(row) {
  return [
    "🫴本日線上公益講座已經上線，邀請大家一起來聆聽。",
    "",
    "🪷歡迎分享給身邊的親朋好友",
    "",
    `🔗${CONFIG.facebookUrl}`,
    "",
    `💎 主題： ${cleanTopic_(row["主題"])}`,
    `🎙️ 講師： ${speakerLine_(row)}`,
    "",
    "✨期待大家支持公益、一起學習成長。",
  ].join("\n");
}
