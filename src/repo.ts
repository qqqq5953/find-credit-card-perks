import type { UserCard } from "./types";

/** 使用者資料存取。正式環境用 D1，測試用記憶體版本 */
export interface Repo {
  ensureUser(userId: string): Promise<void>;
  getUserCards(userId: string): Promise<UserCard[]>;
  setUserCards(userId: string, cards: UserCard[]): Promise<void>;
  setNotify(userId: string, enabled: boolean): Promise<void>;
  getNotify(userId: string): Promise<boolean>;
  /** 持有任一指定卡片、且開啟通知的使用者，以及他們持有的卡 */
  holdersOf(cardIds: string[]): Promise<Map<string, string[]>>;
}

export function d1Repo(db: D1Database): Repo {
  return {
    async ensureUser(userId) {
      await db.prepare("INSERT OR IGNORE INTO users (line_user_id) VALUES (?)").bind(userId).run();
    },
    async getUserCards(userId) {
      const { results } = await db
        .prepare("SELECT card_id, selected_plan FROM user_cards WHERE line_user_id = ? ORDER BY card_id")
        .bind(userId)
        .all<UserCard>();
      return results;
    },
    async setUserCards(userId, cards) {
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO users (line_user_id) VALUES (?)").bind(userId),
        db.prepare("DELETE FROM user_cards WHERE line_user_id = ?").bind(userId),
        ...cards.map((c) =>
          db.prepare("INSERT INTO user_cards (line_user_id, card_id, selected_plan) VALUES (?, ?, ?)").bind(userId, c.card_id, c.selected_plan),
        ),
      ]);
    },
    async setNotify(userId, enabled) {
      await db
        .prepare("INSERT INTO users (line_user_id, notify_enabled) VALUES (?, ?) ON CONFLICT (line_user_id) DO UPDATE SET notify_enabled = excluded.notify_enabled")
        .bind(userId, enabled ? 1 : 0)
        .run();
    },
    async getNotify(userId) {
      const row = await db.prepare("SELECT notify_enabled FROM users WHERE line_user_id = ?").bind(userId).first<{ notify_enabled: number }>();
      return row ? row.notify_enabled === 1 : true;
    },
    async holdersOf(cardIds) {
      const map = new Map<string, string[]>();
      if (!cardIds.length) return map;
      const { results } = await db
        .prepare(
          `SELECT uc.line_user_id, uc.card_id FROM user_cards uc
           JOIN users u ON u.line_user_id = uc.line_user_id
           WHERE u.notify_enabled = 1 AND uc.card_id IN (${cardIds.map(() => "?").join(",")})`,
        )
        .bind(...cardIds)
        .all<{ line_user_id: string; card_id: string }>();
      for (const r of results) map.set(r.line_user_id, [...(map.get(r.line_user_id) ?? []), r.card_id]);
      return map;
    },
  };
}

export function memoryRepo(): Repo & { cards: Map<string, UserCard[]>; notify: Map<string, boolean> } {
  const cards = new Map<string, UserCard[]>();
  const notify = new Map<string, boolean>();
  return {
    cards,
    notify,
    async ensureUser(userId) {
      if (!notify.has(userId)) notify.set(userId, true);
    },
    async getUserCards(userId) {
      return cards.get(userId) ?? [];
    },
    async setUserCards(userId, list) {
      await this.ensureUser(userId);
      cards.set(userId, list);
    },
    async setNotify(userId, enabled) {
      notify.set(userId, enabled);
    },
    async getNotify(userId) {
      return notify.get(userId) ?? true;
    },
    async holdersOf(cardIds) {
      const map = new Map<string, string[]>();
      for (const [userId, list] of cards) {
        if (notify.get(userId) === false) continue;
        const held = list.map((c) => c.card_id).filter((id) => cardIds.includes(id));
        if (held.length) map.set(userId, held);
      }
      return map;
    },
  };
}
