import { describe, expect, it } from "vitest";
import { diffCards, formatNotification } from "../src/engine/diff";
import { makeCard } from "./fixtures";

const base = makeCard({
  id: "c",
  bank: "國泰",
  name: "CUBE",
  switchable: true,
  plans: [{ id: "life", name: "集精選", rules: [{ id: "sm", description: "超市", match: { categories: ["supermarket"] }, rate: 0.03, cap: { period: "month", max_reward: 500 } }] }],
});

const clone = (): typeof base => structuredClone(base);

describe("diffCards", () => {
  it("沒有變動時不產生通知", () => {
    const next = clone();
    next.updated_at = "2026-11-01";
    expect(diffCards([base], [next])).toEqual([]);
  });

  it("回饋率與上限變動", () => {
    const next = clone();
    next.plans[0].rules[0].rate = 0.02;
    next.plans[0].rules[0].cap = { period: "month", max_reward: 300 };
    const [c] = diffCards([base], [next]);
    expect(c.type).toBe("updated");
    expect(c.items).toEqual([
      "【集精選】超市：回饋 3% → 2%",
      "【集精選】超市：每月上限 500 元 → 每月上限 300 元",
    ]);
  });

  it("新增與取消規則、基本回饋變動", () => {
    const next = clone();
    next.base.domestic = 0.005;
    next.plans[0].rules = [{ id: "gas", description: "加油", match: { categories: ["gas"] }, rate: 0.02 }];
    const [c] = diffCards([base], [next]);
    expect(c.items).toEqual([
      "國內基本回饋 1% → 0.5%",
      "新增 【集精選】加油 2%（無上限）",
      "取消 【集精選】超市",
    ]);
  });

  it("卡片新增與移除", () => {
    const other = makeCard({ id: "d" });
    expect(diffCards([base], [other]).map((c) => c.type).sort()).toEqual(["added", "removed"]);
  });

  it("通知訊息格式", () => {
    const text = formatNotification([{ cardId: "c", cardName: "國泰 CUBE", type: "updated", items: ["超市：回饋 3% → 2%"] }]);
    expect(text).toContain("💳 國泰 CUBE\n・超市：回饋 3% → 2%");
  });
});
