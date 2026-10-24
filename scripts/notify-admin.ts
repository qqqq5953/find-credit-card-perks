// 用 LINE 推播通知管理者（你自己）。GitHub Actions 偵測到權益變動或抓取失敗時使用
// 用法：npx tsx scripts/notify-admin.ts "訊息內容"
// 需要環境變數 LINE_CHANNEL_ACCESS_TOKEN、ADMIN_LINE_USER_ID；沒有設定時只印出訊息
import { createLineClient } from "../src/line/client";

const text = process.argv.slice(2).join(" ").trim();
const { LINE_CHANNEL_ACCESS_TOKEN: token, ADMIN_LINE_USER_ID: to } = process.env;

if (!text) {
  console.error("請提供訊息內容");
  process.exit(1);
}
if (!token || !to) {
  console.log(`（未設定 LINE_CHANNEL_ACCESS_TOKEN 或 ADMIN_LINE_USER_ID，略過推播）\n${text}`);
} else {
  await createLineClient(token).push(to, [{ type: "text", text: text.slice(0, 5000) }]);
  console.log("已通知管理者");
}
