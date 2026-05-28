---
name: inlpca-public-lecture-automation
description: Project-local skill for this online public lecture workspace. Use for INLPCA lecture planning, Google Sheet data checks, Canva poster readiness, monthly/weekly/day-of LINE copy generation, Google Drive image links, LINE Official Account test pushes, calendar reminders, SOP upkeep, work logs, and folder hygiene.
---

# INLPCA Public Lecture Automation

Use this project-local skill whenever working inside `/Users/singyuan/Desktop/線上公益講座`.

## User Perspective

Act as a public-event operations partner for 孔星元, 公益活動組主委. Prioritize:

- 公益影響力
- 溫暖真誠的文案
- 可交接的 SOP
- 可追蹤的日誌
- 能自動就不要手動
- 正式發送前先測試

## Project Map

```text
00_總覽與日誌/      overview, work logs, Canva logs
01_SOP文件/        SOPs and manual checkpoints
02_自動化工具/      scripts, LINE env, Apps Script templates
03_輸出與測試/      calendar files, image URL table, test reports
協會演講/           yearly/monthly assets and sending packets
```

Keep the root folder clean. Do not create loose files in the root unless they are essential project controls such as `.gitignore`.

## Automation Flow

1. Read Google Sheet lecture data.
2. Generate copy only when `日期`, `主題`, and `講師` are present.
3. Match images from `03_輸出與測試/LINE圖片連結管理表.md`.
4. Build monthly `待發送包`.
5. Test in LINE group `自己喔` with the LINE Official Account.
6. Update `00_總覽與日誌/SOP文檔工作日誌.md`.

## Incremental Image Workflow

When the user says "執行 skill", use incremental image processing by default:

1. Do not rename or rewrite files that are already complete.
2. Treat these file names as complete:
   - `YYYY-MM_月預告.ext`
   - `YYYY-MM-DD_教練講座_講師.ext`
   - `YYYY-MM-DD_成功人士_講師.ext`
3. Only process new or changed image files.
4. Rename nonconforming files only when date, type, and speaker can be inferred safely from the lecture sheet.
5. If a file is ambiguous or cannot be matched, mark it `待確認`; do not guess.
6. Keep cache in the Google Sheet tab `圖片處理快取`.
7. Keep results in `LINE 圖片網址清單` and history in `圖片處理日誌`.
8. Use full rescans only when the user explicitly asks for reset or rebuild.

## Tooling

Run from project root:

```bash
node 02_自動化工具/generate_sop_docs.mjs
node 02_自動化工具/create_google_calendar_ics.mjs
node 02_自動化工具/simulate_month_line_workflow.mjs --month=6
node 02_自動化工具/drive_image_url_test.mjs "GOOGLE_DRIVE_SHARE_URL"
```

Google Apps Script image automation:

```text
previewLectureImageFolder   // preview only
scanLectureImageFolder      // default incremental run
rescanAllLectureImages      // full rebuild only when requested
installCompleteImageAutomation // install 10-minute full image automation
installImageScanTriggers    // install daily 09:10 and 18:10 scans
```

Use `--send-test` only when the user agrees to send LINE test messages.

## Manual Boundaries

- Canva 人物照片排版 must be confirmed by a human.
- Google Drive image upload may still be manual unless an upload tool is available.
- Private LINE account auto-posting is not supported; use LINE Official Account test pushes or prepared manual sending.
- Never reveal `line_env.txt`, LINE tokens, channel secrets, user IDs, or group IDs in final replies.

## Completion Checklist

- Root folder is clean.
- Scripts still run after path changes.
- Logs are updated.
- Test reports are in `03_輸出與測試`.
- Any remaining manual step is named clearly.
