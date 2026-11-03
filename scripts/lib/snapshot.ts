import type { Source } from "../../src/types";

/** 把頁面文字整理成穩定的格式：去掉多餘空白、空行與每次都會變的雜訊 */
export function normalizeText(text: string, source: Pick<Source, "ignore_patterns">): string {
  let t = text.replace(/\r\n?/g, "\n");
  for (const p of source.ignore_patterns ?? []) t = t.replace(new RegExp(p, "g"), "");
  return t
    .split("\n")
    .map((line) => line.replace(/[ \t 　]+/g, " ").trim())
    .filter(Boolean)
    .join("\n") + "\n";
}

export type SnapshotStatus = "baseline" | "changed" | "unchanged";

export function compareSnapshot(previous: string | null, current: string): SnapshotStatus {
  if (previous === null) return "baseline";
  return previous === current ? "unchanged" : "changed";
}

export const MAX_FOLLOW_LINKS = 15;

/** 第一個標籤以外的網域，例如 card.firstbank.com.tw → firstbank.com.tw */
const siteOf = (host: string) => (host.split(".").length > 2 ? host.split(".").slice(1).join(".") : host);

/** 挑出要點進去的連結：同一個銀行網域、去除重複與頁內錨點，依網址排序讓快照順序穩定 */
export function selectFollowLinks(links: { href: string; text: string }[], baseUrl: string, max = MAX_FOLLOW_LINKS) {
  const site = siteOf(new URL(baseUrl).hostname);
  const seen = new Map<string, string>();
  for (const { href, text } of links) {
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    if (url.hostname !== site && !url.hostname.endsWith(`.${site}`)) continue;
    url.hash = "";
    const key = url.toString();
    if (key === new URL(baseUrl).toString() || seen.has(key)) continue;
    seen.set(key, text.replace(/\s+/g, " ").trim());
  }
  return [...seen].sort(([a], [b]) => a.localeCompare(b)).slice(0, max).map(([href, text]) => ({ href, text }));
}
