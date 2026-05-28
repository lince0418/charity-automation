# 線上公益講座文案自動化 SOP

## 目標

讓系統每天固定檢查 Google 試算表，當同一筆活動資料同時具備：

- 日期
- 主題
- 講師

就自動產生以下文案：

- 月預告
- 教練講座預告
- 成功人士預告
- 上線日通知

並將每次執行結果寫入 `00_總覽與日誌/SOP文檔工作日誌.md`。

## 資料來源

Google 試算表：

https://docs.google.com/spreadsheets/d/1GXGEDEoWd0EwYLKrR9Jx6lhubvtzP1SYkT8ZyAyQiCA/edit?gid=997862433#gid=997862433

目前使用欄位：

| 欄位 | 用途 |
|---|---|
| 日期 | 產生文案日期與歸入月份 |
| 類別 | 判斷是教練講座或成功人士 |
| 講師 | 產生講師欄位 |
| 頭銜 | 接在講師姓名後方 |
| 主題 | 產生文案主題 |

## 產出位置

每月文案會產生在：

`協會演講/2026年/月份/自動產生文案.md`

例如：

`協會演講/2026年/六月份/自動產生文案.md`

## 判斷規則

| 條件 | 系統動作 |
|---|---|
| 日期、主題、講師都有填 | 產生文案 |
| 任一欄缺漏 | 暫不產生文案，寫入工作日誌統計 |
| 既有資料後續更新 | 重新產生該月份文案，並在工作日誌標示變更 |

## 建議檢查時間

建議每天兩次：

| 時間 | 用途 |
|---|---|
| 09:00 | 上午確認是否有新主題、新講師或資料補齊 |
| 18:00 | 傍晚再檢查一次，避免漏掉當日更新 |

## 手動執行方式

在此資料夾執行：

```bash
node 02_自動化工具/generate_sop_docs.mjs
```

## 省流量測試方式

月份模擬預設使用本機快照，不會重複讀取 Google 試算表：

```bash
node 02_自動化工具/simulate_month_line_workflow.mjs --month=5
```

確認後才送到 LINE 測試群組：

```bash
node 02_自動化工具/simulate_month_line_workflow.mjs --month=5 --send-test
```

只有需要重新抓雲端最新資料時，才加上：

```bash
node 02_自動化工具/simulate_month_line_workflow.mjs --month=5 --refresh-sheet
```

## 圖片網址規則

Google Drive 圖片上傳後，先執行 Apps Script 的 `scanLectureImageFolder`，產生「LINE 圖片網址清單」。正式發送前必須確認每個任務都有公開圖片網址；缺圖時可以先做文字測試，但不可視為正式完成。

## 圖片增量自動化

Google Drive 圖片資料夾由 Apps Script 處理，預設只處理新檔或有變動的檔案：

| 函式 | 用途 | 會不會改檔名 |
|---|---|---|
| `previewLectureImageFolder` | 先預覽本次會處理哪些檔案 | 不會 |
| `scanLectureImageFolder` | 正式增量處理，日常使用 | 只改可安全判斷的檔案 |
| `rescanAllLectureImages` | 完整重掃，只有重建資料時使用 | 可能重新檢查全部 |
| `installCompleteImageAutomation` | 完整自動化安裝，推薦只執行一次 | 建立每 10 分鐘自動掃描，並立刻跑一次 |
| `installImageScanTriggers` | 安裝每日 09:10、18:10 自動掃描 | 不直接改檔，僅建立排程 |

完成標準檔名：

| 類型 | 命名 |
|---|---|
| 月預告 | `YYYY-MM_月預告.ext` |
| 教練講座 | `YYYY-MM-DD_教練講座_講師.ext` |
| 成功人士 | `YYYY-MM-DD_成功人士_講師.ext` |

省流量原則：

- 已完成且沒有變動的圖片會略過。
- 不符合命名的圖片，只有能從試算表安全判斷日期、類別、講師時才改名。
- 判斷不出來或有多個可能時，標記為 `待確認`，不硬改。
- 圖片連結固定寫入 Google 試算表 `LINE 圖片網址清單`。
- 執行紀錄寫入 `圖片處理日誌`，快取寫入 `圖片處理快取`。

完整自動化建議：

1. 第一次把最新版 `drive_image_folder_scanner.gs` 貼到 Google Apps Script。
2. 執行一次 `installCompleteImageAutomation`。
3. 之後只要把圖片上傳到 Google Drive 資料夾即可。
4. 系統會每 10 分鐘自動執行 `scanLectureImageFolder`。
5. `scanLectureImageFolder` 會同時完成更名、權限設定、LINE 圖片網址清單更新，不需要再分兩段執行。

## 每日兩次自動執行方式

### 方式 A：用 Mac 排程

可用 macOS 的排程工具每天 09:00 與 18:00 執行：

```bash
cd /Users/singyuan/Desktop/線上公益講座
node 02_自動化工具/generate_sop_docs.mjs
```

### 方式 B：用 Google Apps Script

若未來 Google 試算表改成私密，建議改用 Google Apps Script，因為它可以直接在 Google 試算表授權環境中讀取資料。

建議觸發器：

| 觸發器 | 設定 |
|---|---|
| 時間驅動 | 每天 09:00 左右 |
| 時間驅動 | 每天 18:00 左右 |

## 維護提醒

| 項目 | 建議 |
|---|---|
| 文案格式 | 若協會固定文案有調整，更新 `generate_sop_docs.mjs` 內的模板文字 |
| 年份 | 2027 年開始前，將腳本內 `YEAR = 2026` 改成新年份 |
| 表格欄位 | 若 Google 試算表欄位改名，需同步更新腳本欄位名稱 |
| 日誌 | 每次執行會自動追加到 `00_總覽與日誌/SOP文檔工作日誌.md` |
