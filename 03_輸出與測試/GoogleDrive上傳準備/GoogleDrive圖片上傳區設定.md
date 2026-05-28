# Google Drive 圖片上傳區設定

## 正式資料夾

| 項目 | 內容 |
|---|---|
| 資料夾名稱 | 線上公益講座_圖片上傳區 |
| Google Drive Folder ID | `1OtINARh0rIXM-coiz6dvaso0oN_yKemR` |
| 資料夾連結 | https://drive.google.com/drive/folders/1OtINARh0rIXM-coiz6dvaso0oN_yKemR |
| 所有者 | 公益活動組 `charity@inlpca.org.tw` |
| 權限狀態 | 知道連結的人可檢視 |

## 本機整理完成資料夾

已整理並重新命名的圖片目前在：

```text
03_輸出與測試/GoogleDrive上傳準備/線上公益講座_圖片上傳區
```

## 上傳方式

目前 Codex 可確認 Google Drive 資料夾與權限，但此環境尚未提供「直接上傳 JPG/PNG 到 Google Drive 指定資料夾」的工具。

請將本機整理完成資料夾中的內容，整包拖曳到 Google Drive：

```text
線上公益講座_圖片上傳區
```

上傳完成後，可由 Apps Script 自動掃描該資料夾，產生 LINE 可用圖片網址。

## 後續自動化

後續掃描邏輯會使用：

```text
02_自動化工具/drive_image_folder_scanner.gs
```

掃描後可產生：

```text
https://drive.google.com/uc?export=view&id=FILE_ID
```
