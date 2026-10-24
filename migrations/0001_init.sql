CREATE TABLE users (
  line_user_id TEXT PRIMARY KEY,
  notify_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_cards (
  line_user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  selected_plan TEXT,
  PRIMARY KEY (line_user_id, card_id)
);

CREATE INDEX idx_user_cards_card ON user_cards (card_id);
