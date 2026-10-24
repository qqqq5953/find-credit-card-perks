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
