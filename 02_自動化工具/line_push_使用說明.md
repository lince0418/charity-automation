# LINE 官方帳號測試推播使用說明

## 目標

測試官方帳號是否可以主動發送訊息到：

- 你自己
- 測試群組「自己喔」

## 準備資料

| 資料 | 從哪裡取得 |
|---|---|
| Channel access token | LINE Developers / Messaging API channel |
| groupId | `LINE Webhook 紀錄` 工作表 |
| userId | `LINE Webhook 紀錄` 工作表 |

## 建立設定檔

複製：

```text
02_自動化工具/line_env範本.txt
```

另存成：

```text
02_自動化工具/line_env.txt
```

填入：

```text
LINE_CHANNEL_ACCESS_TOKEN=你的_Channel_access_token
LINE_TO_ID=你的_groupId_或_userId
LINE_TEST_TEXT=公益講座 LINE 官方帳號測試訊息
LINE_IMAGE_URL=
```

## 測試文字推播

執行：

```bash
set -a
source 02_自動化工具/line_env.txt
set +a
node 02_自動化工具/line_push_test.mjs
```

## 測試圖片推播

圖片網址必須是公開 HTTPS。

```text
LINE_IMAGE_URL=https://example.com/test.png
```

再執行同一個測試工具。

## 安全提醒

- `Channel access token` 不要貼到公開文件或群組。
- 如果 token 曾經外流，請到 LINE Developers 重新發行。
- `line_env.txt` 已加入 `.gitignore`，避免誤提交。
