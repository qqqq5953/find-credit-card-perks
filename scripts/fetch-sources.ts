// 抓取 data/sources.json 列出的權益頁面，擷取正文後與 snapshots/ 比對
// 結果寫到 fetch-result.json，GitHub Actions 依此決定要不要請 Claude Code 更新卡片資料
//
// 用法：npm run fetch-sources [-- --only cathay-cube,fubon-j] [--sources 其他設定檔] [--snapshots 其他目錄]
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { extractText, getDocumentProxy } from "unpdf";
import type { Source } from "../src/types";
import { compareSnapshot, normalizeText, type SnapshotStatus } from "./lib/snapshot";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const SNAPSHOT_DIR = arg("--snapshots") ?? "snapshots";
const only = arg("--only") ? new Set(arg("--only")!.split(",")) : null;

const { sources } = JSON.parse(readFileSync(arg("--sources") ?? "data/sources.json", "utf8")) as { sources: Source[] };

async function fetchHtml(browser: Browser, source: Source): Promise<string> {
  const page = await browser.newPage({ locale: "zh-TW" });
  try {
    await page.goto(source.url, { waitUntil: "networkidle", timeout: 60_000 });
    const locator = page.locator(source.selector ?? "body").first();
    return await locator.innerText({ timeout: 15_000 });
  } finally {
    await page.close();
  }
}

async function fetchPdf(source: Source): Promise<string> {
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

interface Result {
  card_id: string;
  status: SnapshotStatus | "error";
  error?: string;
}

async function main() {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const targets = sources.filter((s) => !only || only.has(s.card_id));
  const needsBrowser = targets.some((s) => s.type === "html");
  const browser = needsBrowser
    ? await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {})
    : null;

  const results: Result[] = [];
  try {
    for (const source of targets) {
      const path = `${SNAPSHOT_DIR}/${source.card_id}.txt`;
      try {
        const raw = source.type === "pdf" ? await fetchPdf(source) : await fetchHtml(browser!, source);
        const text = normalizeText(raw, source);
        if (text.trim().length < 50) throw new Error("擷取到的內容太短，selector 可能失效");
        const previous = existsSync(path) ? readFileSync(path, "utf8") : null;
        const status = compareSnapshot(previous, text);
        if (status !== "unchanged") writeFileSync(path, text);
        results.push({ card_id: source.card_id, status });
        console.log(`${status === "changed" ? "🔄" : status === "baseline" ? "🆕" : "✅"} ${source.card_id}: ${status}`);
      } catch (e) {
        results.push({ card_id: source.card_id, status: "error", error: (e as Error).message });
        console.error(`❌ ${source.card_id}: ${(e as Error).message}`);
      }
    }
  } finally {
    await browser?.close();
  }

  const changed = results.filter((r) => r.status === "changed").map((r) => r.card_id);
  const errors = results.filter((r) => r.status === "error");
  writeFileSync("fetch-result.json", JSON.stringify({ changed, errors, results }, null, 2));

  // 給 GitHub Actions 的輸出
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed.join(",")}\nerror_count=${errors.length}\n`);
  }
  console.log(`\n變動：${changed.length} 張，失敗：${errors.length} 張`);
}

main();
