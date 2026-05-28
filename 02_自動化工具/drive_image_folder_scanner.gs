const CONFIG = {
  spreadsheetId: "1GXGEDEoWd0EwYLKrR9Jx6lhubvtzP1SYkT8ZyAyQiCA",
  folderId: "1OtINARh0rIXM-coiz6dvaso0oN_yKemR",
  lectureSheetName: "雙周講師SOP",
  outputSheetName: "LINE 圖片網址清單",
  cacheSheetName: "圖片處理快取",
  logSheetName: "圖片處理日誌",
  year: 2026,
};

function scanLectureImageFolder() {
  return processLectureImageFolder_({ dryRun: false, force: false });
}

function previewLectureImageFolder() {
  return processLectureImageFolder_({ dryRun: true, force: false });
}

function rescanAllLectureImages() {
  return processLectureImageFolder_({ dryRun: false, force: true });
}

function installCompleteImageAutomation() {
  removeImageScanTriggers_();

  ScriptApp.newTrigger("scanLectureImageFolder")
    .timeBased()
    .everyMinutes(10)
    .create();

  scanLectureImageFolder();
}

function installImageScanTriggers() {
  removeImageScanTriggers_();

  ScriptApp.newTrigger("scanLectureImageFolder")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .nearMinute(10)
    .create();

  ScriptApp.newTrigger("scanLectureImageFolder")
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .nearMinute(10)
    .create();
}

function removeImageScanTriggers_() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "scanLectureImageFolder") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function processLectureImageFolder_(options) {
  const startedAt = new Date();
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const rootFolder = DriveApp.getFolderById(CONFIG.folderId);
  const lectures = readLectureRows_(spreadsheet);
  const cache = readCache_(spreadsheet);
  const outputRows = [outputHeader_()];
  const cacheRows = [cacheHeader_()];
  const logRows = [];
  const counters = {
    totalImages: 0,
    skipped: 0,
    renamed: 0,
    linked: 0,
    needsReview: 0,
    unsupported: 0,
  };

  scanFolderIncrementally_(rootFolder, [], lectures, cache, outputRows, cacheRows, logRows, counters, options);

  if (!options.dryRun) {
    writeSheet_(spreadsheet, CONFIG.outputSheetName, outputRows);
    writeSheet_(spreadsheet, CONFIG.cacheSheetName, cacheRows);
  }

  appendProcessLog_(spreadsheet, startedAt, counters, logRows, options);
  return counters;
}

function scanFolderIncrementally_(folder, folderPath, lectures, cache, outputRows, cacheRows, logRows, counters, options) {
  const currentPath = folderPath.concat(folder.getName());
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const mimeType = file.getMimeType();
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
      counters.unsupported += 1;
      continue;
    }

    counters.totalImages += 1;
    const originalName = file.getName();
    const fileId = file.getId();
    const modifiedTime = file.getLastUpdated().toISOString();
    const cacheKey = fileId;
    const cached = cache[cacheKey];
    const alreadyProcessed = cached &&
      cached.modifiedTime === modifiedTime &&
      cached.fileName === originalName &&
      ["完成", "略過"].includes(cached.status) &&
      !options.force;

    const parsed = parseLectureImageName_(originalName);
    let finalName = originalName;
    let status = parsed.valid ? "完成" : "待確認";
    let action = alreadyProcessed ? "略過" : "確認";
    let message = parsed.valid ? "檔名已符合規則" : "檔名不符合規則，無法安全判斷";
    let target = parsed;

    if (!alreadyProcessed && isIgnoredImage_(originalName, currentPath)) {
      status = "略過";
      action = "略過";
      message = "非講座發送圖片，不進行命名";
      target = { valid: false, date: "", type: "非講座圖片", speaker: "" };
    } else if (!alreadyProcessed && !parsed.valid) {
      const suggested = suggestNameFromLectures_(originalName, currentPath, lectures, mimeType);
      if (suggested.ok) {
        finalName = suggested.name;
        target = parseLectureImageName_(finalName);
        status = "完成";
        action = options.dryRun ? "預覽改名" : "已改名";
        message = `由資料表判斷為 ${suggested.reason}`;
        if (!options.dryRun && finalName !== originalName) file.setName(finalName);
        if (finalName !== originalName) counters.renamed += 1;
      } else {
        counters.needsReview += 1;
        message = suggested.reason;
      }
    }

    if (!alreadyProcessed && status === "完成" && !options.dryRun) {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      counters.linked += 1;
    }

    if (alreadyProcessed) counters.skipped += 1;

    const effectiveName = options.dryRun ? finalName : file.getName();
    const effectiveParsed = status === "略過" ? target : parseLectureImageName_(effectiveName);
    const lineImageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    outputRows.push([
      new Date(),
      effectiveName,
      fileId,
      mimeType,
      file.getUrl(),
      lineImageUrl,
      effectiveParsed.date,
      effectiveParsed.type,
      effectiveParsed.speaker,
      status,
      action,
      message,
      currentPath.join("/"),
      modifiedTime,
    ]);

    cacheRows.push([
      fileId,
      effectiveName,
      modifiedTime,
      status,
      effectiveParsed.date,
      effectiveParsed.type,
      effectiveParsed.speaker,
      lineImageUrl,
      currentPath.join("/"),
      new Date(),
    ]);

    if (!alreadyProcessed || status !== "完成") {
      logRows.push([
        new Date(),
        options.dryRun ? "預覽" : "執行",
        action,
        originalName,
        effectiveName,
        status,
        message,
      ]);
    }
  }

  const folders = folder.getFolders();
  while (folders.hasNext()) {
    scanFolderIncrementally_(folders.next(), currentPath, lectures, cache, outputRows, cacheRows, logRows, counters, options);
  }
}

function readLectureRows_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CONFIG.lectureSheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map((value) => String(value).trim());
  return values.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      if (header) item[header] = row[index];
    });
    const date = parseSheetDate_(item["日期"]);
    return {
      date,
      dateKey: date ? formatDateKey_(date) : "",
      monthKey: date ? `${date.getFullYear()}-${pad2_(date.getMonth() + 1)}` : "",
      type: clean_(item["類別"]),
      speaker: clean_(item["講師"]),
      title: clean_(item["主題"]),
    };
  }).filter((item) => item.dateKey && item.type && item.speaker);
}

function readCache_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CONFIG.cacheSheetName);
  if (!sheet) return {};

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return {};

  const headers = values.shift().map((value) => String(value).trim());
  const result = {};
  values.forEach((row) => {
    const item = {};
    headers.forEach((header, index) => item[header] = row[index]);
    const fileId = String(item["檔案ID"] || "").trim();
    if (!fileId) return;
    result[fileId] = {
      fileName: String(item["檔名"] || "").trim(),
      modifiedTime: String(item["最後修改時間"] || "").trim(),
      status: String(item["狀態"] || "").trim(),
    };
  });
  return result;
}

function suggestNameFromLectures_(fileName, folderPath, lectures, mimeType) {
  const ext = extensionFor_(fileName, mimeType);
  const text = `${fileName} ${folderPath.join(" ")}`;
  const normalized = normalize_(text);
  const monthMatch = normalized.match(/20\d{2}[-_/年.]?(\d{1,2})|([一二三四五六七八九十]+)月份/);
  const month = monthMatch ? monthFromText_(monthMatch[0]) : null;

  if (normalized.includes("月預告")) {
    if (!month) return { ok: false, reason: "含月預告，但無法判斷月份" };
    return {
      ok: true,
      name: `${CONFIG.year}-${pad2_(month)}_月預告${ext}`,
      reason: `${CONFIG.year}-${pad2_(month)} 月預告`,
    };
  }

  const candidates = lectures.filter((lecture) => {
    if (month && Number(lecture.monthKey.slice(5, 7)) !== month) return false;
    const compactDate = lecture.dateKey.replace(/-/g, "");
    return normalized.includes(normalize_(lecture.speaker)) ||
      normalized.includes(normalize_(lecture.type)) ||
      typeAliases_(lecture.type).some((alias) => normalized.includes(alias)) ||
      normalized.includes(compactDate) ||
      normalized.includes(lecture.dateKey);
  });

  const speakerMatches = candidates.filter((lecture) => normalized.includes(normalize_(lecture.speaker)));
  const typeMatches = candidates.filter((lecture) =>
    normalized.includes(normalize_(lecture.type)) ||
    typeAliases_(lecture.type).some((alias) => normalized.includes(alias))
  );
  const exactCandidates = speakerMatches.length ? speakerMatches : typeMatches;

  if (exactCandidates.length === 1) {
    const lecture = exactCandidates[0];
    return {
      ok: true,
      name: `${lecture.dateKey}_${lecture.type}_${sanitizeNamePart_(lecture.speaker)}${ext}`,
      reason: `${lecture.dateKey} ${lecture.type} ${lecture.speaker}`,
    };
  }

  if (month && candidates.length === 1) {
    const lecture = candidates[0];
    return {
      ok: true,
      name: `${lecture.dateKey}_${lecture.type}_${sanitizeNamePart_(lecture.speaker)}${ext}`,
      reason: `${lecture.dateKey} ${lecture.type} ${lecture.speaker}`,
    };
  }

  if (exactCandidates.length > 1 || candidates.length > 1) return { ok: false, reason: "找到多個可能活動，為避免誤改請人工確認" };
  return { ok: false, reason: "找不到可對應的日期、類別、講師" };
}

function parseLectureImageName_(filename) {
  const cleanName = filename.replace(/\.[^.]+$/, "");
  const monthly = cleanName.match(/^(\d{4}-\d{2})_月預告$/);
  if (monthly) return { valid: true, date: monthly[1], type: "月預告", speaker: "" };

  const event = cleanName.match(/^(\d{4}-\d{2}-\d{2})_(教練講座|成功人士)_([^_]+)(?:_.*)?$/);
  if (event) return { valid: true, date: event[1], type: event[2], speaker: event[3] };

  return { valid: false, date: "", type: "", speaker: "" };
}

function outputHeader_() {
  return [
    "掃描時間",
    "檔名",
    "檔案ID",
    "MIME類型",
    "Drive分享連結",
    "LINE可用圖片網址",
    "推測日期",
    "推測類型",
    "推測講師",
    "狀態",
    "處理動作",
    "說明",
    "所在資料夾",
    "最後修改時間",
  ];
}

function cacheHeader_() {
  return [
    "檔案ID",
    "檔名",
    "最後修改時間",
    "狀態",
    "推測日期",
    "推測類型",
    "推測講師",
    "LINE可用圖片網址",
    "所在資料夾",
    "快取更新時間",
  ];
}

function writeSheet_(spreadsheet, sheetName, rows) {
  const sheet = getOrCreateSheet_(spreadsheet, sheetName);
  sheet.clear();
  if (rows.length) {
    const range = sheet.getRange(1, 1, rows.length, rows[0].length);
    range.setNumberFormat("@");
    range.setValues(rows);
  }
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);
}

function appendProcessLog_(spreadsheet, startedAt, counters, logRows, options) {
  const sheet = getOrCreateSheet_(spreadsheet, CONFIG.logSheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 8).setValues([[
      "時間",
      "模式",
      "總圖片",
      "略過",
      "改名",
      "產生連結",
      "待確認",
      "備註",
    ]]);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    startedAt,
    options.dryRun ? "預覽" : options.force ? "完整重掃" : "增量執行",
    counters.totalImages,
    counters.skipped,
    counters.renamed,
    counters.linked,
    counters.needsReview,
    `不支援檔案 ${counters.unsupported} 個`,
  ]);

  if (!logRows.length) return;
  const detailStart = sheet.getLastRow() + 2;
  sheet.getRange(detailStart, 1, 1, 7).setValues([["時間", "模式", "動作", "原檔名", "新檔名", "狀態", "說明"]]);
  sheet.getRange(detailStart + 1, 1, logRows.length, 7).setValues(logRows);
}

function parseSheetDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return new Date(CONFIG.year, value.getMonth(), value.getDate());
  }
  const match = String(value || "").trim().match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  return new Date(CONFIG.year, Number(match[1]) - 1, Number(match[2]));
}

function monthFromText_(text) {
  const digit = String(text).match(/(\d{1,2})/);
  if (digit) return Number(digit[1]);
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
  const chinese = String(text).match(/(十一|十二|十|一|二|三|四|五|六|七|八|九)/);
  return chinese ? map[chinese[1]] : null;
}

function formatDateKey_(date) {
  return `${date.getFullYear()}-${pad2_(date.getMonth() + 1)}-${pad2_(date.getDate())}`;
}

function extensionFor_(fileName, mimeType) {
  const match = String(fileName).match(/(\.[^.]+)$/);
  if (match) return match[1].toLowerCase();
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

function typeAliases_(type) {
  if (type === "教練講座") return ["nlp教練", "教練模板", "教練圖", "講座模板"];
  if (type === "成功人士") return ["成功人士模板", "成功人士圖", "人物專訪", "專訪模板"];
  return [];
}

function isIgnoredImage_(fileName, folderPath) {
  const normalized = normalize_(`${fileName} ${folderPath.join(" ")}`);
  const inCoverFolder = folderPath.some((part) => clean_(part) === "封面");
  return normalized.includes("google表單封面") ||
    normalized.includes("表單封面") ||
    inCoverFolder;
}

function sanitizeNamePart_(value) {
  return clean_(value).replace(/\s+/g, "-").replace(/[\\/:*?"<>|]/g, "-");
}

function normalize_(value) {
  return clean_(value).toLowerCase().replace(/\s+/g, "").replace(/[＿_－—–-]/g, "");
}

function clean_(value) {
  return String(value || "").replace(/\s*\n\s*/g, "、").trim();
}

function pad2_(value) {
  return String(value).padStart(2, "0");
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}
