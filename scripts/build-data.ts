// 把 data/cards/*.json 合併成 src/generated/cards.json，讓 Worker 打包時可以直接 import
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function loadCardsFromDir(dir = "data/cards") {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync("src/generated", { recursive: true });
  const cards = loadCardsFromDir();
  writeFileSync("src/generated/cards.json", JSON.stringify(cards, null, 2) + "\n");
  console.log(`已輸出 ${cards.length} 張卡到 src/generated/cards.json`);
}
