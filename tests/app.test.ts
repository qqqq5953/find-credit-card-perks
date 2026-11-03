import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/index";
import type { LineClient, LineMessage } from "../src/line/client";
import { memoryRepo } from "../src/repo";
import { makeCard } from "./fixtures";

// 測試用的卡片，不依賴 data/cards/ 的實際內容
const catalog = [
  makeCard({
    id: "test-switch",
    bank: "測試銀行",
    name: "切換卡",
    switchable: true,
    plans: [
      { id: "digital", name: "數位", rules: [{ id: "d1", description: "網購", match: { categories: ["online"] }, rate: 0.03 }] },
      { id: "life", name: "生活", rules: [{ id: "l1", description: "超市", match: { categories: ["supermarket"] }, rate: 0.02 }] },
    ],
  }),
  makeCard({ id: "test-plain", bank: "測試銀行", name: "一般卡" }),
  makeCard({ id: "test-other", bank: "其他銀行", name: "其他卡" }),
];

const SECRET = "test-channel-secret";
const env = {
  LINE_CHANNEL_SECRET: SECRET,
  LINE_CHANNEL_ACCESS_TOKEN: "token",
  LIFF_ID: "1234-abcd",
  LINE_LOGIN_CHANNEL_ID: "1234",
  NOTIFY_SECRET: "notify-secret",
} as unknown as Env;

let repo: ReturnType<typeof memoryRepo>;
let replies: LineMessage[][];
let pushes: { to: string; messages: LineMessage[] }[];

const line: LineClient = {
  async reply(_token, messages) {
    replies.push(messages);
  },
  async push(to, messages) {
    pushes.push({ to, messages });
  },
};

const app = createApp({
  catalog,
  repo: () => repo,
  line: () => line,
  verifyIdToken: async (token) => (token === "good-token" ? "U-liff" : null),
  today: () => "2026-10-24",
});

async function sign(body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

async function sendText(text: string, userId = "U1") {
  const body = JSON.stringify({ events: [{ type: "message", replyToken: "r", source: { userId }, message: { type: "text", text } }] });
  return app.request("/webhook", { method: "POST", body, headers: { "x-line-signature": await sign(body) } }, env);
}

beforeEach(() => {
  repo = memoryRepo();
  replies = [];
  pushes = [];
});

describe("webhook", () => {
  it("簽章錯誤時拒絕", async () => {
    const res = await app.request("/webhook", { method: "POST", body: "{}", headers: { "x-line-signature": "bad" } }, env);
    expect(res.status).toBe(401);
  });

  it("還沒設定卡片時，引導到 LIFF", async () => {
    await sendText("全聯 800");
    const msg = replies[0][0] as any;
    expect(msg.type).toBe("template");
    expect(msg.template.actions[0].uri).toBe("https://liff.line.me/1234-abcd");
  });

  it("回覆推薦結果", async () => {
    await repo.setUserCards("U1", [{ card_id: "test-switch", selected_plan: "life" }, { card_id: "test-plain", selected_plan: null }]);
    await sendText("全聯 800");
    const msg = replies[0][0] as any;
    expect(msg.type).toBe("flex");
    expect(msg.altText).toContain("測試銀行 切換卡");
    expect(msg.contents.header.contents[0].text).toBe("🛒 全聯");
  });

  it("無法辨識的商家回覆類別按鈕", async () => {
    await repo.setUserCards("U1", [{ card_id: "test-plain", selected_plan: null }]);
    await sendText("巷口麵攤");
    const msg = replies[0][0] as any;
    expect(msg.quickReply.items.length).toBeGreaterThan(5);
  });

  it("關閉通知", async () => {
    await sendText("關閉通知");
    expect(repo.notify.get("U1")).toBe(false);
  });
});

describe("LIFF API", () => {
  it("需要登入", async () => {
    expect((await app.request("/api/my-cards", {}, env)).status).toBe(401);
  });

  it("儲存卡片：去除重複、補上切換型卡片的預設方案、拒絕未知卡片", async () => {
    const headers = { authorization: "Bearer good-token", "content-type": "application/json" };
    const ok = await app.request("/api/my-cards", {
      method: "PUT",
      headers,
      body: JSON.stringify({ cards: [{ card_id: "test-switch" }, { card_id: "test-switch" }, { card_id: "test-plain", selected_plan: "x" }], notify: false }),
    }, env);
    expect(ok.status).toBe(200);
    expect(repo.cards.get("U-liff")).toEqual([
      { card_id: "test-switch", selected_plan: "digital" },
      { card_id: "test-plain", selected_plan: null },
    ]);
    expect(repo.notify.get("U-liff")).toBe(false);

    const bad = await app.request("/api/my-cards", { method: "PUT", headers, body: JSON.stringify({ cards: [{ card_id: "nope" }] }) }, env);
    expect(bad.status).toBe(400);
  });
});

describe("/internal/notify", () => {
  const changes = [
    { cardId: "test-switch", cardName: "測試銀行 切換卡", type: "updated", items: ["超市：回饋 2% → 1.5%"] },
    { cardId: "test-plain", cardName: "測試銀行 一般卡", type: "updated", items: ["海外：回饋 3% → 2%"] },
  ];
  const post = (auth: string) =>
    app.request("/internal/notify", { method: "POST", headers: { authorization: auth }, body: JSON.stringify({ changes }) }, env);

  it("需要 NOTIFY_SECRET", async () => {
    expect((await post("Bearer wrong")).status).toBe(401);
  });

  it("只推播給持卡且開啟通知的使用者，並合併成一則", async () => {
    await repo.setUserCards("A", [{ card_id: "test-switch", selected_plan: "digital" }, { card_id: "test-plain", selected_plan: null }]);
    await repo.setUserCards("B", [{ card_id: "test-other", selected_plan: null }]);
    await repo.setUserCards("C", [{ card_id: "test-plain", selected_plan: null }]);
    await repo.setNotify("C", false);

    const res = await post("Bearer notify-secret");
    expect(await res.json()).toEqual({ sent: 1, failed: 0 });
    expect(pushes).toHaveLength(1);
    expect(pushes[0].to).toBe("A");
    const text = (pushes[0].messages[0] as any).text as string;
    expect(text).toContain("切換卡");
    expect(text).toContain("一般卡");
  });
});
