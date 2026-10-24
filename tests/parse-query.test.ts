import { describe, expect, it } from "vitest";
import { parseQuery, isRecognized } from "../src/engine/parse-query";
import { dictionary } from "./fixtures";

const parse = (s: string) => parseQuery(s, dictionary);

describe("parseQuery", () => {
  it("商家加金額", () => {
    expect(parse("全聯 800")).toMatchObject({ merchant: "全聯", category: "supermarket", amount: 800, region: "domestic" });
  });

  it("金額在前、有千分位和「元」", () => {
    expect(parse("1,500元 中油")).toMatchObject({ merchant: "中油", category: "gas", amount: 1500 });
  });

  it("別名與大小寫", () => {
    expect(parse("ubereats")).toMatchObject({ merchant: "Uber Eats", category: "delivery", amount: null });
  });

  it("較長的商家名稱優先：Uber Eats 不會被當成 Uber", () => {
    expect(parse("Uber Eats 300").merchant).toBe("Uber Eats");
    expect(parse("Uber 300").merchant).toBe("Uber");
  });

  it("名稱含數字的商家不會被當成金額", () => {
    expect(parse("7-11 100")).toMatchObject({ merchant: "7-ELEVEN", amount: 100 });
    expect(parse("711")).toMatchObject({ merchant: "7-ELEVEN", amount: null });
  });

  it("只有類別關鍵字", () => {
    expect(parse("加油 1500")).toMatchObject({ merchant: null, category: "gas", amount: 1500 });
  });

  it("海外消費", () => {
    expect(parse("日本 5000")).toMatchObject({ category: "overseas", region: "overseas", amount: 5000 });
    expect(parse("日本 星巴克")).toMatchObject({ merchant: "星巴克", region: "overseas" });
  });

  it("支付方式加商家", () => {
    expect(parse("LINE Pay 全聯 300")).toMatchObject({ payment: "linepay", merchant: "全聯", amount: 300 });
  });

  it("無法辨識", () => {
    const q = parse("不知道的店 200");
    expect(isRecognized(q)).toBe(false);
    expect(q.amount).toBe(200);
  });
});
