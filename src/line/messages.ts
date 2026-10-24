import type { Recommendation } from "../engine/calculate";
import type { Query } from "../engine/parse-query";
import { capText, pct } from "../engine/diff";
import type { Category } from "../types";
import type { LineMessage } from "./client";

const MEDALS = ["🥇", "🥈", "🥉"];
const MAX_RESULTS = 3;

const text = (t: string, extra: Record<string, unknown> = {}): LineMessage => ({ type: "text", text: t, ...extra });
const money = (n: number) => `${Math.round(n).toLocaleString("en-US")}`;

export function categoryQuickReply(categories: Category[]) {
  return {
    items: categories
      .filter((c) => c.quick_reply)
      .slice(0, 13) // LINE Quick Reply 最多 13 個
      .map((c) => ({
        type: "action",
        action: { type: "postback", label: c.name, data: `category=${c.id}`, displayText: c.name },
      })),
  };
}

export function manageCardsMessage(liffUrl: string, intro = "先設定你手上有哪些信用卡，我才能幫你比較 👇"): LineMessage {
  return {
    type: "template",
    altText: "設定我的卡片",
    template: {
      type: "buttons",
      text: intro.slice(0, 160),
      actions: [{ type: "uri", label: "設定我的卡片", uri: liffUrl }],
    },
  };
}

export function helpMessage(categories: Category[]): LineMessage {
  return text(
    [
      "直接輸入消費，我會告訴你刷哪張卡最划算：",
      "・全聯 800",
      "・Uber Eats",
      "・LINE Pay 全聯 300",
      "・日本 5000",
      "",
      "其他指令：",
      "・我的卡片：設定持有的卡",
      "・關閉通知／開啟通知：權益變動提醒",
    ].join("\n"),
    { quickReply: categoryQuickReply(categories) },
  );
}

export function unknownQueryMessage(categories: Category[]): LineMessage {
  return text("我還不認識這家商店 🙏\n請選一個最接近的消費類別：", { quickReply: categoryQuickReply(categories) });
}

function detailLine(r: Recommendation): string {
  const parts: string[] = [r.rule ? r.rule.description : "基本回饋"];
  if (r.card.switchable) parts.push(`方案：${r.plan.name}`);
  if (r.rule?.cap) parts.push(r.capped ? `${capText(r.rule.cap)}（本筆已超過）` : capText(r.rule.cap));
  parts.push(...r.conditions);
  return parts.join(" · ");
}

function resultBox(r: Recommendation, index: number) {
  const contents: Record<string, unknown>[] = [
    { type: "text", text: `${MEDALS[index]} ${r.card.bank} ${r.card.name}`, weight: "bold", size: "md", wrap: true },
    {
      type: "text",
      text: `回饋 ${pct(r.effectiveRate)} · 約 ${money(r.rewardTwd)} 元`,
      size: index === 0 ? "xl" : "lg",
      weight: "bold",
      color: index === 0 ? "#06C755" : "#333333",
    },
    { type: "text", text: detailLine(r), size: "xs", color: "#888888", wrap: true },
  ];
  if (r.betterPlan) {
    contents.push({
      type: "text",
      text: `💡 切換到「${r.betterPlan.plan.name}」可得約 ${money(r.betterPlan.rewardTwd)} 元`,
      size: "xs",
      color: "#E67E22",
      wrap: true,
    });
  }
  if (!r.card.verified) {
    contents.push({ type: "text", text: "⚠️ 範例資料，尚未對照官網確認", size: "xxs", color: "#C0392B", wrap: true });
  }
  return { type: "box", layout: "vertical", spacing: "xs", contents };
}

export function recommendationMessage(
  q: Query,
  results: Recommendation[],
  label: string,
  liffUrl: string,
  categories: Category[],
): LineMessage {
  const top = results.slice(0, MAX_RESULTS);
  const best = top[0];
  const amountText = q.amount ? `NT$${money(q.amount)}` : `未輸入金額，以 NT$${money(best.amount)} 試算`;

  const body: Record<string, unknown>[] = [];
  top.forEach((r, i) => {
    if (i > 0) body.push({ type: "separator", margin: "md" });
    body.push(resultBox(r, i));
  });

  return {
    type: "flex",
    altText: `推薦刷 ${best.card.bank} ${best.card.name}：回饋 ${pct(best.effectiveRate)}，約 ${money(best.rewardTwd)} 元`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: `🛒 ${label}`, weight: "bold", size: "lg", wrap: true },
          { type: "text", text: amountText, size: "sm", color: "#888888" },
        ],
      },
      body: { type: "box", layout: "vertical", spacing: "md", contents: body },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: "#06C755", height: "sm", action: { type: "uri", label: "查看官方權益", uri: best.card.source_urls[0] } },
          { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "管理我的卡片", uri: liffUrl } },
          { type: "text", text: "試算僅供參考，實際回饋以銀行公告為準", size: "xxs", color: "#AAAAAA", align: "center", wrap: true },
        ],
      },
    },
    quickReply: categoryQuickReply(categories),
  };
}
