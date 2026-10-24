import type { Card } from "../src/types";
import { dictionary } from "../src/data";

export { dictionary };

export function makeCard(overrides: Partial<Card> & Pick<Card, "id">): Card {
  return {
    bank: "測試銀行",
    name: overrides.id,
    source_urls: ["https://example.com"],
    verified: true,
    updated_at: "2026-10-01",
    reward_unit: { type: "cash", name: "現金", twd_value: 1 },
    base: { domestic: 0.01, overseas: 0.015 },
    switchable: false,
    plans: [{ id: "default", name: "一般", rules: [] }],
    ...overrides,
  };
}

export const TODAY = "2026-10-24";
