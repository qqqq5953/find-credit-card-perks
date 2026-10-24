import { describe, expect, it } from "vitest";
import { recommend, todayInTaipei } from "../src/engine/calculate";
import { parseQuery } from "../src/engine/parse-query";
import { dictionary, makeCard, TODAY } from "./fixtures";

const q = (s: string) => parseQuery(s, dictionary);

const supermarketCard = makeCard({
  id: "super",
  plans: [{
    id: "default", name: "一般",
    rules: [{ id: "sm", description: "超市", match: { categories: ["supermarket"] }, rate: 0.05, cap: { period: "month", max_reward: 20 } }],
  }],
});
const plainCard = makeCard({ id: "plain", base: { domestic: 0.02, overseas: 0.02 } });
const switchCard = makeCard({
  id: "switch",
  switchable: true,
  base: { domestic: 0.003, overseas: 0.003 },
  plans: [
    { id: "a", name: "數位", rules: [{ id: "a1", description: "網購", match: { categories: ["online"] }, rate: 0.03 }] },
    { id: "b", name: "生活", rules: [{ id: "b1", description: "超市", match: { categories: ["supermarket"] }, rate: 0.04 }] },
  ],
});

describe("recommend", () => {
  it("依預估回饋排序", () => {
    const r = recommend(q("全聯 300"), [{ card_id: "super", selected_plan: null }, { card_id: "plain", selected_plan: null }], [supermarketCard, plainCard], TODAY);
    expect(r.map((x) => x.card.id)).toEqual(["super", "plain"]);
    expect(r[0].rewardTwd).toBeCloseTo(15);
    expect(r[0].capped).toBe(false);
  });

  it("超過上限的部分只算基本回饋", () => {
    // 1000 × 5% = 50 > 上限 20；20 / 5% = 400 元吃到加碼，剩下 600 元 × 1% = 6
    const [r] = recommend(q("全聯 1000"), [{ card_id: "super", selected_plan: null }], [supermarketCard], TODAY);
    expect(r.capped).toBe(true);
    expect(r.rewardTwd).toBeCloseTo(26);
  });

  it("上限讓高回饋卡輸給無上限的卡", () => {
    const r = recommend(q("全聯 5000"), [{ card_id: "super", selected_plan: null }, { card_id: "plain", selected_plan: null }], [supermarketCard, plainCard], TODAY);
    expect(r[0].card.id).toBe("plain");
  });

  it("過期規則不計入", () => {
    const expired = makeCard({
      id: "exp",
      plans: [{ id: "default", name: "一般", rules: [{ id: "x", description: "超市", match: { categories: ["supermarket"] }, rate: 0.1, valid_to: "2026-09-30" }] }],
    });
    const [r] = recommend(q("全聯 100"), [{ card_id: "exp", selected_plan: null }], [expired], TODAY);
    expect(r.rule).toBeNull();
    expect(r.rewardTwd).toBeCloseTo(1);
  });

  it("切換型卡片使用選擇的方案，並提示更好的方案", () => {
    const [r] = recommend(q("全聯 1000"), [{ card_id: "switch", selected_plan: "a" }], [switchCard], TODAY);
    expect(r.plan.id).toBe("a");
    expect(r.rule).toBeNull();
    expect(r.betterPlan?.plan.id).toBe("b");
    expect(r.betterPlan?.rewardTwd).toBeCloseTo(40);
  });

  it("海外消費使用海外基本回饋", () => {
    const [r] = recommend(q("日本 1000"), [{ card_id: "plain", selected_plan: null }], [makeCard({ id: "plain" })], TODAY);
    expect(r.rewardTwd).toBeCloseTo(15);
  });

  it("需要指定支付方式的規則，沒用該支付方式時不符合", () => {
    const payCard = makeCard({
      id: "pay",
      plans: [{ id: "default", name: "一般", rules: [{ id: "lp", description: "LINE Pay", match: { payments: ["linepay"] }, rate: 0.05 }] }],
    });
    const uc = [{ card_id: "pay", selected_plan: null }];
    expect(recommend(q("全聯 100"), uc, [payCard], TODAY)[0].rule).toBeNull();
    expect(recommend(q("LINE Pay 全聯 100"), uc, [payCard], TODAY)[0].rule?.id).toBe("lp");
  });

  it("點數依 twd_value 換算", () => {
    const points = makeCard({ id: "pts", reward_unit: { type: "miles", name: "哩程", twd_value: 0.4 } });
    const [r] = recommend(q("全聯 1000"), [{ card_id: "pts", selected_plan: null }], [points], TODAY);
    expect(r.rewardTwd).toBeCloseTo(4);
  });

  it("使用者的卡不在資料庫中時略過", () => {
    expect(recommend(q("全聯"), [{ card_id: "gone", selected_plan: null }], [plainCard], TODAY)).toEqual([]);
  });

  it("台灣時區日期", () => {
    expect(todayInTaipei(new Date("2026-10-24T17:00:00Z"))).toBe("2026-10-25");
  });
});
