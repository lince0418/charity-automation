#!/bin/zsh
cd "$(dirname "$0")"
/Users/singyuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node 02_自動化工具/generate_dashboard.mjs --refresh-sheet
status=$?
echo ""
if [ "$status" = "0" ]; then
  echo "年度儀表板已更新。"
  echo "檔案位置：00_總覽與日誌/2026線上公益講座一頁式進度儀表板.html"
else
  echo "年度儀表板更新失敗。"
  echo "若 Google 試算表不是公開 CSV，請改用 Apps Script 授權版 HTML 儀表板。"
fi
echo ""
read "?按 Enter 關閉視窗..."
