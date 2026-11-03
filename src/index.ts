import { Hono } from "hono";
import { catalog as defaultCatalog, dictionary } from "./data";
import { recommend, todayInTaipei } from "./engine/calculate";
import { formatNotification, type CardChange } from "./engine/diff";
import { isRecognized, parseQuery, type Query } from "./engine/parse-query";
import { createLineClient, type LineClient } from "./line/client";
import { helpMessage, manageCardsMessage, recommendationMessage, unknownQueryMessage } from "./line/messages";
import { verifySignature } from "./line/signature";
import { d1Repo, type Repo } from "./repo";
import type { Card, UserCard } from "./types";

export interface Env {
  DB: D1Database;
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LIFF_ID: string;
  LINE_LOGIN_CHANNEL_ID: string;
  NOTIFY_SECRET: string;
}

export interface Deps {
  catalog: Card[];
  repo(env: Env): Repo;
  line(env: Env): LineClient;
  /** 驗證 LIFF 的 ID token，回傳 LINE user ID；失敗回傳 null */
  verifyIdToken(idToken: string, env: Env): Promise<string | null>;
  today(): string;
}

async function verifyIdTokenWithLine(idToken: string, env: Env): Promise<string | null> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: env.LINE_LOGIN_CHANNEL_ID }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { sub?: string };
  return data.sub ?? null;
}

const defaultDeps: Deps = {
  catalog: defaultCatalog,
  repo: (env) => d1Repo(env.DB),
  line: (env) => createLineClient(env.LINE_CHANNEL_ACCESS_TOKEN),
  verifyIdToken: verifyIdTokenWithLine,
  today: () => todayInTaipei(),
};

const MANAGE_COMMANDS = ["我的卡片", "管理卡片", "設定卡片", "卡片"];
const HELP_COMMANDS = ["說明", "使用說明", "help", "?", "？"];

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
  postback?: { data: string };
}

function queryLabel(q: Query): string {
  const category = dictionary.categories.find((c) => c.id === q.category);
  const payment = dictionary.payments.find((p) => p.id === q.payment);
  const main = q.merchant ?? category?.name ?? "消費";
  return payment ? `${payment.name} · ${main}` : main;
}

export function createApp(deps: Deps = defaultDeps) {
  const app = new Hono<{ Bindings: Env }>();
  const catalog = deps.catalog;
  const liffUrl = (env: Env) => `https://liff.line.me/${env.LIFF_ID}`;

  async function handleEvent(event: LineEvent, env: Env) {
    const userId = event.source?.userId;
    const replyToken = event.replyToken;
    if (!userId || !replyToken) return;
    const repo = deps.repo(env);
    const line = deps.line(env);
    const reply = (...messages: Record<string, unknown>[]) => line.reply(replyToken, messages);

    const answer = async (q: Query) => {
      const userCards = await repo.getUserCards(userId);
      if (!userCards.length) return reply(manageCardsMessage(liffUrl(env)));
      if (!isRecognized(q)) return reply(unknownQueryMessage(dictionary.categories));
      const results = recommend(q, userCards, catalog, deps.today());
      if (!results.length) return reply(manageCardsMessage(liffUrl(env), "你設定的卡片目前都不在資料庫中，請重新設定 👇"));
      return reply(recommendationMessage(q, results, queryLabel(q), liffUrl(env), dictionary.categories));
    };

    if (event.type === "follow") {
      await repo.ensureUser(userId);
      return reply(
        { type: "text", text: "嗨！我可以幫你找出每筆消費最划算的信用卡 💳" },
        manageCardsMessage(liffUrl(env)),
      );
    }

    if (event.type === "postback" && event.postback) {
      const category = new URLSearchParams(event.postback.data).get("category");
      if (category) {
        return answer({ raw: category, amount: null, merchant: null, payment: null, category, region: dictionary.categories.find((c) => c.id === category)?.region ?? "domestic" });
      }
      return;
    }

    if (event.type === "message" && event.message?.type === "text" && event.message.text) {
      const input = event.message.text.trim();
      if (MANAGE_COMMANDS.includes(input)) return reply(manageCardsMessage(liffUrl(env), "點下方按鈕設定你持有的信用卡 👇"));
      if (HELP_COMMANDS.includes(input.toLowerCase())) return reply(helpMessage(dictionary.categories));
      if (input === "關閉通知" || input === "開啟通知") {
        const enabled = input === "開啟通知";
        await repo.setNotify(userId, enabled);
        return reply({ type: "text", text: enabled ? "已開啟權益變動通知 🔔" : "已關閉權益變動通知 🔕" });
      }
      return answer(parseQuery(input, dictionary));
    }

    if (event.type === "message") return reply(helpMessage(dictionary.categories));
  }

  app.post("/webhook", async (c) => {
    const body = await c.req.text();
    if (!(await verifySignature(body, c.req.header("x-line-signature"), c.env.LINE_CHANNEL_SECRET))) {
      return c.text("invalid signature", 401);
    }
    const { events = [] } = JSON.parse(body) as { events?: LineEvent[] };
    for (const event of events) {
      try {
        await handleEvent(event, c.env);
      } catch (e) {
        console.error("處理 LINE 事件失敗", event.type, e);
      }
    }
    return c.text("ok");
  });

  // ---- LIFF 頁面使用的 API ----

  app.get("/api/config", (c) => c.json({ liffId: c.env.LIFF_ID }));

  app.get("/api/catalog", (c) =>
    c.json(
      catalog.map((card) => ({
        id: card.id,
        bank: card.bank,
        name: card.name,
        image: card.image ?? null,
        verified: card.verified,
        switchable: card.switchable,
        plans: card.plans.map((p) => ({ id: p.id, name: p.name })),
      })),
    ),
  );

  async function authUser(c: { req: { header(name: string): string | undefined }; env: Env }) {
    const token = c.req.header("authorization")?.replace(/^Bearer /i, "");
    return token ? deps.verifyIdToken(token, c.env) : null;
  }

  app.get("/api/my-cards", async (c) => {
    const userId = await authUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const repo = deps.repo(c.env);
    return c.json({ cards: await repo.getUserCards(userId), notify: await repo.getNotify(userId) });
  });

  app.put("/api/my-cards", async (c) => {
    const userId = await authUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const body = (await c.req.json().catch(() => null)) as { cards?: UserCard[]; notify?: boolean } | null;
    if (!body || !Array.isArray(body.cards)) return c.json({ error: "cards 必須是陣列" }, 400);

    const cards: UserCard[] = [];
    for (const uc of body.cards) {
      const card = catalog.find((x) => x.id === uc?.card_id);
      if (!card) return c.json({ error: `未知的卡片 ${uc?.card_id}` }, 400);
      const plan = card.switchable ? card.plans.find((p) => p.id === uc.selected_plan)?.id ?? card.plans[0].id : null;
      if (!cards.some((x) => x.card_id === card.id)) cards.push({ card_id: card.id, selected_plan: plan });
    }
    const repo = deps.repo(c.env);
    await repo.setUserCards(userId, cards);
    if (typeof body.notify === "boolean") await repo.setNotify(userId, body.notify);
    return c.json({ cards });
  });

  // ---- GitHub Actions 在卡片資料更新並部署後呼叫，推播給持卡人 ----

  app.post("/internal/notify", async (c) => {
    if (!c.env.NOTIFY_SECRET || c.req.header("authorization") !== `Bearer ${c.env.NOTIFY_SECRET}`) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const { changes = [] } = (await c.req.json()) as { changes?: CardChange[] };
    const relevant = changes.filter((ch) => ch.type !== "added" && ch.items.length);
    const holders = await deps.repo(c.env).holdersOf(relevant.map((ch) => ch.cardId));
    const line = deps.line(c.env);

    let sent = 0;
    const failed: string[] = [];
    for (const [userId, cardIds] of holders) {
      const mine = relevant.filter((ch) => cardIds.includes(ch.cardId));
      try {
        await line.push(userId, [{ type: "text", text: formatNotification(mine).slice(0, 5000) }]);
        sent++;
      } catch (e) {
        console.error("推播失敗", userId, e);
        failed.push(userId);
      }
    }
    return c.json({ sent, failed: failed.length });
  });

  return app;
}

export default createApp();
