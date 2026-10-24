import type { Card, Plan, Rule, UserCard } from "../types";
import type { Query } from "./parse-query";

/** 沒輸入金額時，用這個金額試算 */
export const DEFAULT_AMOUNT = 1000;

export interface Recommendation {
  card: Card;
  plan: Plan;
  /** null 代表只有基本回饋 */
  rule: Rule | null;
  amount: number;
  /** 這筆消費實際的回饋率（達到上限時會比 rule.rate 低） */
  effectiveRate: number;
  /** 換算成台幣的預估回饋 */
  rewardTwd: number;
  capped: boolean;
  conditions: string[];
  /** 切換型的卡：如果切換到別的方案會更划算 */
  betterPlan?: { plan: Plan; rule: Rule; rewardTwd: number };
}

const inPeriod = (today: string, from?: string, to?: string) =>
  (!from || from <= today) && (!to || today <= to);

export function ruleMatches(rule: Rule, q: Query): boolean {
  const m = rule.match;
  if (m.region && m.region !== q.region) return false;
  if (m.payments && (!q.payment || !m.payments.includes(q.payment))) return false;
  // 有指定類別或商家時，任一符合即可
  if (m.categories || m.merchants) {
    const byCategory = !!q.category && !!m.categories?.includes(q.category);
    const byMerchant = !!q.merchant && !!m.merchants?.includes(q.merchant);
    if (!byCategory && !byMerchant) return false;
  }
  return Boolean(m.region || m.payments || m.categories || m.merchants);
}

/** 單筆消費的回饋（以 reward_unit 計）：超過上限的部分只算基本回饋 */
function rewardFor(amount: number, rate: number, baseRate: number, maxReward?: number) {
  const full = amount * rate;
  if (maxReward === undefined || full <= maxReward) return { reward: full, capped: false };
  const cappedAmount = maxReward / rate;
  return { reward: maxReward + (amount - cappedAmount) * baseRate, capped: true };
}

interface Option {
  plan: Plan;
  rule: Rule | null;
  reward: number;
  capped: boolean;
}

function bestOptionInPlan(card: Card, plan: Plan, q: Query, amount: number, today: string): Option {
  const baseRate = card.base[q.region];
  let best: Option = { plan, rule: null, reward: amount * baseRate, capped: false };
  if (!inPeriod(today, card.valid_from, card.valid_to)) return best;
  for (const rule of plan.rules) {
    if (!inPeriod(today, rule.valid_from, rule.valid_to) || !ruleMatches(rule, q)) continue;
    const r = rewardFor(amount, rule.rate, baseRate, rule.cap?.max_reward);
    if (r.reward > best.reward) best = { plan, rule, ...r };
  }
  return best;
}

export function recommend(
  q: Query,
  userCards: UserCard[],
  catalog: Card[],
  today: string,
): Recommendation[] {
  const amount = q.amount ?? DEFAULT_AMOUNT;
  const results: Recommendation[] = [];

  for (const uc of userCards) {
    const card = catalog.find((c) => c.id === uc.card_id);
    if (!card) continue;
    const plan = card.plans.find((p) => p.id === uc.selected_plan) ?? card.plans[0];
    const best = bestOptionInPlan(card, plan, q, amount, today);
    const twd = card.reward_unit.twd_value;

    let betterPlan: Recommendation["betterPlan"];
    if (card.switchable) {
      for (const other of card.plans) {
        if (other.id === plan.id) continue;
        const alt = bestOptionInPlan(card, other, q, amount, today);
        if (alt.rule && alt.reward > best.reward && alt.reward * twd > (betterPlan?.rewardTwd ?? 0)) {
          betterPlan = { plan: other, rule: alt.rule, rewardTwd: alt.reward * twd };
        }
      }
    }

    results.push({
      card,
      plan,
      rule: best.rule,
      amount,
      effectiveRate: best.reward / amount,
      rewardTwd: best.reward * twd,
      capped: best.capped,
      conditions: best.rule?.conditions ?? [],
      betterPlan,
    });
  }

  return results.sort(
    (a, b) => b.rewardTwd - a.rewardTwd || Number(b.card.verified) - Number(a.card.verified),
  );
}

/** 台灣時區的今天，格式 YYYY-MM-DD */
export function todayInTaipei(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
