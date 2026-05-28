const inputUrl = process.argv[2] || process.env.DRIVE_IMAGE_SHARE_URL || "";

if (!inputUrl) {
  console.error("請提供 Google Drive 圖片分享連結。");
  console.error("用法：node 02_自動化工具/drive_image_url_test.mjs 'https://drive.google.com/file/d/FILE_ID/view?usp=sharing'");
  process.exit(1);
}

const fileId = extractDriveFileId(inputUrl);
if (!fileId) {
  console.error("無法從連結中解析 Google Drive fileId。");
  process.exit(1);
}

const candidates = [
  `https://drive.google.com/uc?export=view&id=${fileId}`,
  `https://drive.google.com/uc?export=download&id=${fileId}`,
  `https://lh3.googleusercontent.com/d/${fileId}`,
];

console.log(`Google Drive fileId: ${fileId}`);

for (const url of candidates) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    const contentType = response.headers.get("content-type") || "";
    console.log("");
    console.log(url);
    console.log(`HTTP ${response.status}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(contentType.startsWith("image/") ? "可能可供 LINE 圖片推播使用" : "可能不是直接圖片網址");
  } catch (error) {
    console.log("");
    console.log(url);
    console.log(`測試失敗：${error.message}`);
  }
}

function extractDriveFileId(url) {
  const patterns = [
    /\/file\/d\/([^/]+)/,
    /[?&]id=([^&]+)/,
    /\/d\/([^/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return "";
}
