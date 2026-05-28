# LINE 圖片公開網址 SOP

## 目標

讓 Canva 或本機資料夾中的圖片文宣，變成 LINE Messaging API 可以發送的圖片網址。

LINE 圖片訊息需要：

```text
https://...
```

不能使用：

```text
/Users/singyuan/Desktop/...
```

## 建議流程

| 步驟 | 動作 | 負責人 |
|---|---|---|
| 1 | 從 Canva 下載 PNG 或 JPG | 孔星元或組員 |
| 2 | 放入對應月份資料夾 | 孔星元 |
| 3 | 上傳圖片到雲端 | 孔星元 |
| 4 | 設定任何知道連結的人都可檢視 | 孔星元 |
| 5 | 取得公開圖片網址 | 孔星元 |
| 6 | 將網址填入 `03_輸出與測試/LINE圖片連結管理表.md` | 孔星元或 Codex |
| 7 | Codex 測試 LINE 圖片推播 | Codex |

## Google Drive 使用注意

Google Drive 分享連結通常不是直接圖片網址。

一般分享連結長得像：

```text
https://drive.google.com/file/d/FILE_ID/view?usp=sharing
```

可嘗試轉成：

```text
https://drive.google.com/uc?export=view&id=FILE_ID
```

但 LINE API 不一定接受所有 Google Drive 圖片連結。若 LINE 發送失敗，建議改用可直接讀圖的圖片空間或網站。

## 最穩判斷

把圖片網址貼到瀏覽器無痕視窗中，若能直接看到圖片，且網址是 HTTPS，才適合給 LINE API 使用。

## 正式發送前檢查

| 檢查項目 | 完成 |
|---|---|
| 圖片可在無痕視窗直接打開 |  |
| 圖片不需要登入 |  |
| 圖片網址為 HTTPS |  |
| 圖片內容為正確講座主題 |  |
| 圖片與文案日期一致 |  |
| 已先發到「自己喔」測試群組 |  |
