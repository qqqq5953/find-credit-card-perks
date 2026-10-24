import type { Category, Merchant, Payment, Region } from "../types";

export interface Query {
  raw: string;
  amount: number | null;
  merchant: string | null;
  category: string | null;
  payment: string | null;
  region: Region;
}

export interface Dictionary {
  categories: Category[];
  payments: Payment[];
  merchants: Merchant[];
}

const normalize = (s: string) => s.toLowerCase().replace(/[\s　]+/g, " ").trim();

/** 在文字中找出最長的關鍵字，避免「Uber」搶走「Uber Eats」 */
function longestMatch<T>(text: string, items: T[], keysOf: (item: T) => string[]): { item: T; key: string } | null {
  let best: { item: T; key: string } | null = null;
  for (const item of items) {
    for (const key of keysOf(item)) {
      const k = normalize(key);
      if (k && text.includes(k) && k.length > (best?.key.length ?? 0)) best = { item, key: k };
    }
  }
  return best;
}

/** 解析「全聯 800」、「LINE Pay 全聯 300」、「日本 5000元」這類輸入 */
export function parseQuery(input: string, dict: Dictionary): Query {
  let text = normalize(input);

  // 先找商家和支付方式，再把它們從文字中移除，避免「7-11」、「711」被當成金額
  const merchant = longestMatch(text, dict.merchants, (m) => [m.name, ...(m.aliases ?? [])]);
  if (merchant) text = text.replace(merchant.key, " ");
  const payment = longestMatch(text, dict.payments, (p) => [p.name, ...p.keywords]);
  if (payment) text = text.replace(payment.key, " ");

  const category = merchant
    ? dict.categories.find((c) => c.id === merchant.item.category) ?? null
    : longestMatch(text, dict.categories, (c) => [c.name, ...c.keywords])?.item ?? null;

  // 金額：支援 800、1,500、NT$800、800元
  const amountMatch = text.match(/(\d[\d,]*)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) || null : null;

  // 「日本 星巴克」這種同時有商家和地區的輸入，也要判斷成海外消費
  const overseasHint = longestMatch(text, dict.categories.filter((c) => c.region === "overseas"), (c) => [c.name, ...c.keywords]);
  const region: Region = merchant?.item.region ?? category?.region ?? (overseasHint ? "overseas" : "domestic");

  return {
    raw: input,
    amount,
    merchant: merchant?.item.name ?? null,
    category: category?.id ?? null,
    payment: payment?.item.id ?? null,
    region,
  };
}

/** 有沒有辨識出任何可以拿來比較的資訊 */
export function isRecognized(q: Query): boolean {
  return Boolean(q.merchant || q.category || q.payment);
}
