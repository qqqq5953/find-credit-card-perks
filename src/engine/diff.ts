import type { Cap, Card, Rule } from "../types";

export interface CardChange {
  cardId: string;
  cardName: string;
  type: "added" | "removed" | "updated";
  items: string[];
}

export const pct = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;

const PERIOD_NAMES: Record<Cap["period"], string> = {
  month: "每月",
  quarter: "每季",
  half_year: "每半年",
  year: "每年",
  once: "活動期間",
};

export const capText = (cap?: Cap) => (cap ? `${PERIOD_NAMES[cap.period]}上限 ${cap.max_reward} 元` : "無上限");

const displayName = (c: Card) => `${c.bank} ${c.name}`;

function diffRule(label: string, a: Rule, b: Rule): string[] {
  const items: string[] = [];
  if (a.rate !== b.rate) items.push(`${label}：回饋 ${pct(a.rate)} → ${pct(b.rate)}`);
  if (capText(a.cap) !== capText(b.cap)) items.push(`${label}：${capText(a.cap)} → ${capText(b.cap)}`);
  if ((a.valid_to ?? "") !== (b.valid_to ?? "")) {
    items.push(`${label}：活動期限 ${a.valid_to ?? "未定"} → ${b.valid_to ?? "未定"}`);
  }
  const ca = (a.conditions ?? []).join("、");
  const cb = (b.conditions ?? []).join("、");
  if (ca !== cb) items.push(`${label}：條件改為「${cb || "無"}」`);
  return items;
}

/** 比對新舊卡片資料，只列出使用者看得懂、會影響刷卡選擇的變動 */
export function diffCards(oldCards: Card[], newCards: Card[]): CardChange[] {
  const changes: CardChange[] = [];
  const oldById = new Map(oldCards.map((c) => [c.id, c]));
  const newById = new Map(newCards.map((c) => [c.id, c]));

  for (const [id, o] of oldById) {
    if (!newById.has(id)) {
      changes.push({ cardId: id, cardName: displayName(o), type: "removed", items: ["此卡已從資料庫移除"] });
    }
  }

  for (const [id, n] of newById) {
    const o = oldById.get(id);
    if (!o) {
      changes.push({ cardId: id, cardName: displayName(n), type: "added", items: ["新增卡片"] });
      continue;
    }
    const items: string[] = [];
    for (const region of ["domestic", "overseas"] as const) {
      if (o.base[region] !== n.base[region]) {
        items.push(`${region === "domestic" ? "國內" : "海外"}基本回饋 ${pct(o.base[region])} → ${pct(n.base[region])}`);
      }
    }
    if ((o.valid_to ?? "") !== (n.valid_to ?? "")) {
      items.push(`權益期限 ${o.valid_to ?? "未定"} → ${n.valid_to ?? "未定"}`);
    }

    const oldPlans = new Map(o.plans.map((p) => [p.id, p]));
    for (const np of n.plans) {
      const op = oldPlans.get(np.id);
      const prefix = n.switchable ? `【${np.name}】` : "";
      if (!op) {
        items.push(`新增方案${prefix}`);
        continue;
      }
      const oldRules = new Map(op.rules.map((r) => [r.id, r]));
      for (const nr of np.rules) {
        const or = oldRules.get(nr.id);
        const label = `${prefix}${nr.description}`;
        if (!or) items.push(`新增 ${label} ${pct(nr.rate)}（${capText(nr.cap)}）`);
        else items.push(...diffRule(label, or, nr));
      }
      for (const or of op.rules) {
        if (!np.rules.some((r) => r.id === or.id)) items.push(`取消 ${prefix}${or.description}`);
      }
    }
    for (const op of o.plans) {
      if (!n.plans.some((p) => p.id === op.id)) items.push(`取消方案【${op.name}】`);
    }

    if (items.length) changes.push({ cardId: id, cardName: displayName(n), type: "updated", items });
  }
  return changes;
}

/** 推播給單一使用者的訊息：把他持有的卡的變動合併成一則 */
export function formatNotification(changes: CardChange[]): string {
  const blocks = changes.map((c) => `💳 ${c.cardName}\n${c.items.map((i) => `・${i}`).join("\n")}`);
  return `📢 你的信用卡權益有變動\n\n${blocks.join("\n\n")}\n\n詳細內容以銀行公告為準。`;
}
