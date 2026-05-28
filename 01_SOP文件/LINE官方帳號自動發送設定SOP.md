# LINE 官方帳號自動發送設定 SOP

## 目前目標

先用你的官方帳號「公益活動組主委-孔星元」建立安全測試流程：

1. 取得官方帳號的 Messaging API 權限。
2. 取得 Channel access token。
3. 透過 webhook 取得你的 `userId` 或測試群組「自己喔」的 `groupId`。
4. 先測試發送文字。
5. 再測試發送圖片。
6. 成功後再接到線上公益講座文案流程。

## 重要原則

| 原則 | 說明 |
|---|---|
| 先測試自己 | 不先碰正式協會社群，避免誤發 |
| Token 不公開 | Channel access token 等同發送權限，不要貼到公開地方 |
| 先文字後圖片 | 文字成功後再測圖片，問題比較好排除 |
| 圖片需要 HTTPS | LINE API 不能直接讀你電腦本機圖片，圖片需是公開 HTTPS 圖片網址 |

## 第 1 步：確認 Messaging API

1. 打開 LINE Official Account Manager。
2. 進入官方帳號「公益活動組主委-孔星元」。
3. 找到「設定」。
4. 找到「Messaging API」。
5. 啟用 Messaging API。
6. 若系統要求建立 Provider，請建立或選擇你的 Provider。

完成後，你應該可以看到：

- Channel ID
- Channel secret
- Channel access token
- Webhook URL 設定欄位

## 第 2 步：允許加入群組

1. 到 LINE Developers Console。
2. 進入你的 Messaging API channel。
3. 找到 Messaging API 設定。
4. 確認 `Allow bot to join group chats` 是啟用狀態。

這樣官方帳號才可以加入你建立的測試群組「自己喔」。

## 第 3 步：取得 userId 或 groupId

需要透過 webhook 取得。

測試方式：

1. 設定一個 webhook URL。
2. 你傳訊息給官方帳號，會收到你的 `userId`。
3. 你在「自己喔」群組傳訊息，會收到群組的 `groupId`。

之後系統發送時：

| 目標 | 使用 ID |
|---|---|
| 傳給你自己 | `userId` |
| 傳到「自己喔」群組 | `groupId` |

### 本機接收工具

已建立本機 webhook 接收工具：

```text
02_自動化工具/line_webhook_capture.mjs
```

執行後會在本機開啟：

```text
http://localhost:8787/webhook
```

但 LINE Developers 的 Webhook URL 必須是公開 HTTPS，所以本機網址需要透過 ngrok 或其他 HTTPS tunnel 暫時公開。

測試完成後，收到的 `userId` 或 `groupId` 會記錄到：

```text
00_總覽與日誌/LINE官方帳號測試日誌.md
```

### 不安裝 ngrok 的替代方式：Google Apps Script

如果無法安裝 ngrok，改用 Google Apps Script 最方便。

已建立 Apps Script 範本：

```text
02_自動化工具/line_webhook_google_apps_script.gs
```

這個方式會把 LINE webhook 收到的資料寫進 Google 試算表，包含：

| 欄位 | 用途 |
|---|---|
| userId | 官方帳號傳訊息給個人時使用 |
| groupId | 官方帳號傳訊息到群組時使用 |
| 訊息內容 | 確認是哪一次測試 |
| 收到時間 | 確認 webhook 是否成功 |

操作流程：

1. 建立一份新的 Google 試算表，例如「LINE 官方帳號 Webhook 測試」。
2. 打開試算表上方選單「擴充功能」。
3. 點「Apps Script」。
4. 刪除原本內容。
5. 貼上 `line_webhook_google_apps_script.gs` 的內容。
6. 點「部署」。
7. 選「新增部署作業」。
8. 類型選「網頁應用程式」。
9. 執行身分選「我」。
10. 存取權選「任何人」。
11. 部署後複製「網頁應用程式網址」。
12. 將這個網址貼到 LINE Developers 的 Webhook URL。
13. 在 LINE Developers 按「驗證」。
14. 到 LINE 對官方帳號或測試群組傳訊息。
15. 回到 Google 試算表查看 `LINE Webhook 紀錄` 工作表。

## 第 4 步：測試文字發送

測試成功條件：

- 官方帳號能傳一則文字給你自己。
- 官方帳號能傳一則文字到「自己喔」群組。

## 第 5 步：測試圖片發送

測試成功條件：

- 圖片是 JPG 或 PNG。
- 圖片網址是 HTTPS。
- 原圖不超過 LINE 限制。
- 官方帳號能傳圖片到你自己或測試群組。

## 第 6 步：接上公益講座流程

測試成功後，再接：

- Google 試算表資料
- 自動產生文案
- Canva 圖片文宣
- 待發送包
- 官方帳號測試推播

## 當前進度

| 日期 | 狀態 |
|---|---|
| 2026/05/28 | 開始建立 LINE 官方帳號測試流程 |
