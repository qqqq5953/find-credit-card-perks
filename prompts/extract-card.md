# 把信用卡權益原文整理成 JSON

> 用法：把這整份內容，加上 `data/schema/card.schema.json`、`data/categories.json`、`data/merchants.json` 的內容，以及銀行權益頁面的全文，一起貼到 Claude 網頁版。

你是信用卡權益資料整理員。請把下方「權益原文」整理成**一個**符合 schema 的 JSON 物件，只輸出 JSON，不要其他說明。

## 規則

1. **只寫原文有明確寫出的內容**，不要推測。原文沒寫上限就不要填 `cap`。
2. `rate` 是符合條件時的**總回饋率**（含基本回饋），0.03 代表 3%。原文寫「最高 X%」但需要多個條件疊加時，用一般使用者最容易達成的組合，並把需要的條件寫進 `conditions`。
3. `match` 只能使用 `categories.json` 裡的類別 ID、`payments` 裡的支付方式 ID、`merchants.json` 裡的商家名稱。原文的指定通路不在 merchants.json 時，改用最接近的類別，並在 `notes` 列出「建議新增的商家：…」。
4. `match` 裡的 `categories` 和 `merchants` 是「任一符合」；`payments` 和 `region` 是「必須符合」。
5. 權益可以自行切換方案的卡（例如每日切換），`switchable: true`，每個方案一個 `plans` 項目；一般卡只有一個 `id: "default"` 的方案。
6. `id` 一律使用小寫英文和連字號；卡片 ID 格式為「銀行-卡名」，例如 `cathay-cube`。規則 ID 在同一張卡內不可重複，更新資料時**沿用舊的 ID**。
7. 點數或哩程要填 `reward_unit.twd_value`（1 點約等於多少台幣），原文沒寫時用常見兌換比例，並在 `notes` 註明。
8. 日期格式 `YYYY-MM-DD`；`updated_at` 填今天。
9. `verified` 一律填 `false`，由人工確認後再改成 `true`。
10. 登錄、自動扣繳、名額限制、新戶限定、排除項目等，寫進 `conditions` 或 `exclusions`；無法結構化的重要資訊寫進 `notes`。

## 權益原文

（貼在這裡）
