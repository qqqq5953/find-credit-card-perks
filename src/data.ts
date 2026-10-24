import cardsJson from "./generated/cards.json";
import categoriesJson from "../data/categories.json";
import merchantsJson from "../data/merchants.json";
import type { Card, Category, Merchant, Payment } from "./types";
import type { Dictionary } from "./engine/parse-query";

// src/generated/cards.json 由 `npm run build-data` 從 data/cards/*.json 產生
export const catalog = cardsJson as Card[];

export const dictionary: Dictionary = {
  categories: categoriesJson.categories as Category[],
  payments: categoriesJson.payments as Payment[],
  merchants: merchantsJson.merchants as Merchant[],
};
