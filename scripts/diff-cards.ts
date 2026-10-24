// 比對某個 git 版本與目前 data/cards/ 的差異，輸出給 /internal/notify 使用的 JSON
// 用法：npm run diff-cards -- --base HEAD~1 > changes.json
import { execFileSync } from "node:child_process";
import { diffCards } from "../src/engine/diff";
import type { Card } from "../src/types";
import { loadCardsFromDir } from "./build-data";

const baseArg = process.argv.indexOf("--base");
const base = baseArg > 0 ? process.argv[baseArg + 1] : "HEAD~1";

function loadCardsAt(ref: string): Card[] {
  let files: string[];
  try {
    files = execFileSync("git", ["ls-tree", "--name-only", `${ref}:data/cards`], { encoding: "utf8" }).split("\n").filter((f) => f.endsWith(".json"));
  } catch {
    return []; // 該版本還沒有 data/cards
  }
  return files.map((f) => JSON.parse(execFileSync("git", ["show", `${ref}:data/cards/${f}`], { encoding: "utf8" })));
}

const changes = diffCards(loadCardsAt(base), loadCardsFromDir() as Card[]);
process.stdout.write(JSON.stringify({ changes }, null, 2) + "\n");
