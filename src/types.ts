// 卡片權益資料的型別，對應 data/schema/card.schema.json

export type Region = "domestic" | "overseas";
export type CapPeriod = "month" | "quarter" | "half_year" | "year" | "once";

export interface RewardUnit {
  type: "cash" | "points" | "miles";
  name: string;
  /** 1 單位回饋等於多少台幣，用來把點數或哩程換算成可比較的金額 */
  twd_value: number;
}

export interface RuleMatch {
  /** 任一類別符合即可，例如 supermarket */
  categories?: string[];
  /** 任一商家符合即可，名稱需對應 data/merchants.json */
  merchants?: string[];
  /** 必須使用其中一種支付方式，例如 linepay */
  payments?: string[];
  /** 限定國內或海外消費 */
  region?: Region;
}

export interface Cap {
  period: CapPeriod;
  /** 這條規則在一個週期內最多回饋多少（以 reward_unit 計） */
  max_reward: number;
}

export interface Rule {
  /** 在同一張卡內穩定不變的 ID，用來比對變動 */
  id: string;
  description: string;
  match: RuleMatch;
  /** 符合時的總回饋率（含基本回饋），0.03 代表 3% */
  rate: number;
  cap?: Cap;
  conditions?: string[];
  valid_from?: string;
  valid_to?: string;
}

export interface Plan {
  id: string;
  name: string;
  rules: Rule[];
}

export interface Card {
  id: string;
  bank: string;
  name: string;
  image?: string;
  source_urls: string[];
  /** 是否已對照官網原文人工確認過 */
  verified: boolean;
  updated_at: string;
  valid_from?: string;
  valid_to?: string;
  reward_unit: RewardUnit;
  base: { domestic: number; overseas: number };
  /** 權益可自行切換的卡（例如 CUBE），使用者要選擇目前的方案 */
  switchable: boolean;
  plans: Plan[];
  exclusions?: string[];
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  keywords: string[];
  /** 放在 Quick Reply 的類別按鈕 */
  quick_reply?: boolean;
  /** 此類別代表海外消費 */
  region?: Region;
}

export interface Payment {
  id: string;
  name: string;
  keywords: string[];
}

export interface Merchant {
  name: string;
  category: string;
  aliases?: string[];
  region?: Region;
}

export interface Source {
  card_id: string;
  url: string;
  type: "html" | "pdf";
  /** 只擷取權益正文的 CSS selector，避免廣告或日期造成誤報 */
  selector?: string;
  /** 正文中每次都會變動、要忽略的文字（正規表示式） */
  ignore_patterns?: string[];
}

export interface UserCard {
  card_id: string;
  selected_plan: string | null;
}
