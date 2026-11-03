// 檢查 data/cards/*.json：符合 schema、ID 不重複、引用的類別/商家/支付方式存在，並列出即將過期的規則
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import type { Card } from "../src/types";

const DIR = "data/cards";
const WARN_DAYS = 30;

const schema = JSON.parse(readFileSync("data/schema/card.schema.json", "utf8"));
const { categories, payments } = JSON.parse(readFileSync("data/categories.json", "utf8"));
const { merchants } = JSON.parse(readFileSync("data/merchants.json", "utf8"));
const { sources } = JSON.parse(readFileSync("data/sources.json", "utf8"));

const categoryIds = new Set<string>(categories.map((c: { id: string }) => c.id));
const paymentIds = new Set<string>(payments.map((p: { id: string }) => p.id));
const merchantNames = new Set<string>(merchants.map((m: { name: string }) => m.name));

const validate = new Ajv({ allErrors: true }).compile(schema);
const today = new Date().toISOString().slice(0, 10);
const soon = new Date(Date.now() + WARN_DAYS * 86400_000).toISOString().slice(0, 10);

const errors: string[] = [];
const warnings: string[] = [];
const seenIds = new Set<string>();

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const where = `${DIR}/${file}`;
  let card: Card;
  try {
    card = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  } catch (e) {
    errors.push(`${where}: JSON 格式錯誤 ${(e as Error).message}`);
    continue;
  }
  if (!validate(card)) {
    for (const err of validate.errors ?? []) errors.push(`${where}: ${err.instancePath || "/"} ${err.message}`);
    continue;
  }

  if (file !== `${card.id}.json`) errors.push(`${where}: 檔名必須是 ${card.id}.json`);
  if (seenIds.has(card.id)) errors.push(`${where}: 卡片 ID 重複 ${card.id}`);
  seenIds.add(card.id);
  if (card.switchable && card.plans.length < 2) errors.push(`${where}: switchable 的卡至少要有 2 個方案`);
  if (!card.verified) warnings.push(`${where}: 尚未對照官網確認（verified: false）`);
  if (!sources.some((s: { card_id: string }) => s.card_id === card.id)) {
    warnings.push(`${where}: data/sources.json 沒有這張卡的抓取來源，無法自動偵測變動`);
  }
  if (card.valid_to && card.valid_to < today) warnings.push(`${where}: 整張卡的權益已於 ${card.valid_to} 到期`);

  const planIds = new Set<string>();
  const ruleIds = new Set<string>();
  for (const plan of card.plans) {
    if (planIds.has(plan.id)) errors.push(`${where}: 方案 ID 重複 ${plan.id}`);
    planIds.add(plan.id);
    for (const rule of plan.rules) {
      const at = `${where} [${plan.id}/${rule.id}]`;
      if (ruleIds.has(rule.id)) errors.push(`${at}: 規則 ID 在同一張卡內必須唯一`);
      ruleIds.add(rule.id);
      const m = rule.match;
      if (!m.categories && !m.merchants && !m.payments && !m.region) errors.push(`${at}: match 至少要有一個條件`);
      for (const c of m.categories ?? []) if (!categoryIds.has(c)) errors.push(`${at}: 未知的類別 ${c}`);
      for (const p of m.payments ?? []) if (!paymentIds.has(p)) errors.push(`${at}: 未知的支付方式 ${p}`);
      for (const name of m.merchants ?? []) {
        if (!merchantNames.has(name)) errors.push(`${at}: 商家「${name}」不在 data/merchants.json`);
      }
      if (rule.valid_from && rule.valid_to && rule.valid_from > rule.valid_to) errors.push(`${at}: valid_from 晚於 valid_to`);
      if (rule.valid_to && rule.valid_to < today) warnings.push(`${at}: 已於 ${rule.valid_to} 到期`);
      else if (rule.valid_to && rule.valid_to <= soon) warnings.push(`${at}: 將於 ${rule.valid_to} 到期`);
    }
  }
}

const sourceIds = new Set<string>();
for (const src of sources as { card_id: string; bank?: string; name?: string; url?: string; type?: string }[]) {
  const at = `data/sources.json [${src.card_id}]`;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(src.card_id ?? "")) errors.push(`${at}: card_id 格式錯誤`);
  if (sourceIds.has(src.card_id)) errors.push(`${at}: card_id 重複`);
  sourceIds.add(src.card_id);
  if (!src.bank || !src.name) errors.push(`${at}: 需要填 bank 和 name`);
  if (src.type !== "html" && src.type !== "pdf") errors.push(`${at}: type 必須是 html 或 pdf`);
  if (src.url && !/^https?:\/\//.test(src.url)) errors.push(`${at}: url 格式錯誤`);
  if (!src.url) warnings.push(`${at}: 還沒有權益頁面網址，會在 GitHub Actions 中由 Claude 搜尋補上`);
  else if (!seenIds.has(src.card_id)) warnings.push(`${at}: 卡片資料尚未建立，會在第一次抓到頁面後由 Claude 建立`);
}

for (const w of warnings) console.warn(`⚠️  ${w}`);
for (const e of errors) console.error(`❌ ${e}`);
console.log(`\n檢查 ${seenIds.size} 張卡：${errors.length} 個錯誤、${warnings.length} 個提醒`);
process.exit(errors.length ? 1 : 0);
