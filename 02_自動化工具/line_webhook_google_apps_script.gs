/**
 * LINE 官方帳號 Webhook 接收器
 *
 * 用途：
 * 1. 接收 LINE Webhook 事件。
 * 2. 自動記錄 userId / groupId / roomId。
 * 3. 把原始 JSON 留存，方便除錯。
 *
 * 使用方式：
 * 1. 建立 Google 試算表。
 * 2. 擴充功能 -> Apps Script。
 * 3. 貼上本程式碼。
 * 4. 部署 -> 新增部署作業 -> 網頁應用程式。
 * 5. 執行身分：我。
 * 6. 存取權：任何人。
 * 7. 將 /exec 網址貼到 LINE 的 Webhook URL。
 */

const CONFIG = {
  logSheetName: "LINE Webhook 紀錄",
  rawSheetName: "LINE Webhook 原始資料",
};

function doGet() {
  return ContentService
    .createTextOutput("LINE webhook receiver is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  const receivedAt = new Date();
  const body = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = getOrCreateSheet_(spreadsheet, CONFIG.logSheetName);
  const rawSheet = getOrCreateSheet_(spreadsheet, CONFIG.rawSheetName);

  setupLogHeader_(logSheet);
  setupRawHeader_(rawSheet);

  let payload;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    rawSheet.appendRow([receivedAt, "JSON_PARSE_ERROR", body]);
    return jsonOutput_({ ok: false, error: "JSON_PARSE_ERROR" });
  }

  rawSheet.appendRow([receivedAt, "OK", body]);

  const events = payload.events || [];
  if (events.length === 0) {
    logSheet.appendRow([
      receivedAt,
      "NO_EVENT",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "LINE 驗證或空事件",
    ]);
    return jsonOutput_({ ok: true, eventCount: 0 });
  }

  events.forEach((event) => {
    const source = event.source || {};
    const message = event.message || {};
    const row = [
      receivedAt,
      event.type || "",
      source.type || "",
      source.userId || "",
      source.groupId || "",
      source.roomId || "",
      message.type || "",
      message.text || "",
      event.replyToken || "",
      buildNote_(event),
    ];
    logSheet.appendRow(row);
  });

  return jsonOutput_({ ok: true, eventCount: events.length });
}

function setupLogHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    "收到時間",
    "事件類型",
    "來源類型",
    "userId",
    "groupId",
    "roomId",
    "訊息類型",
    "訊息內容",
    "replyToken",
    "備註",
  ]);
  sheet.setFrozenRows(1);
}

function setupRawHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(["收到時間", "狀態", "原始 JSON"]);
  sheet.setFrozenRows(1);
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function buildNote_(event) {
  const source = event.source || {};
  if (source.type === "user" && source.userId) {
    return "這是個人 userId，可用於推播給你自己。";
  }
  if (source.type === "group" && source.groupId) {
    return "這是群組 groupId，可用於推播到測試群組。";
  }
  if (source.type === "room" && source.roomId) {
    return "這是多人聊天室 roomId。";
  }
  return "";
}

function jsonOutput_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 本機測試用：不用等 LINE，先確認試算表寫入正常。
 * 在 Apps Script 裡選擇 testDoPost 後按執行。
 */
function testDoPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        events: [
          {
            type: "message",
            replyToken: "test-reply-token",
            source: {
              type: "group",
              groupId: "C_TEST_GROUP_ID",
              userId: "U_TEST_USER_ID",
            },
            message: {
              type: "text",
              text: "測試 groupId",
            },
          },
        ],
      }),
    },
  };

  doPost(fakeEvent);
}
