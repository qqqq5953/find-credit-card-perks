# 建立或更新卡片資料（GitHub Actions 中的 Claude Code 使用）

- 權益頁面有變動的卡片：{{CHANGED}}
- 第一次抓到權益頁面、需要建立資料的卡片：{{NEW_CARDS}}

權益原文存在 `snapshots/<卡片ID>.txt`。卡片的銀行與卡名在 `data/sources.json`。

## 需要建立資料的卡片

1. 讀取完整的 `snapshots/<卡片ID>.txt`。
2. 依照 `prompts/extract-card.md` 的規則，建立 `data/cards/<卡片ID>.json`；檔案已存在（範例資料）就整份改寫。
   - `id` 必須等於卡片 ID，`bank`、`name` 沿用 `data/sources.json`，`source_urls` 填該卡的 url。

## 權益頁面有變動的卡片

1. 用 `git diff HEAD -- snapshots/<卡片ID>.txt` 查看原文**改了什麼**，並讀取完整的 snapshot。
2. 讀取 `data/cards/<卡片ID>.json`，依照 `prompts/extract-card.md` 的規則更新：
   - 只修改原文確實改變的部分，**沿用既有的方案 ID 和規則 ID**。
   - 如果變動只是文案、排版、與回饋無關的內容，就不要修改 JSON。

## 共同規則

- 修改過的卡片，`verified` 設為 `false`、`updated_at` 設為今天。
- snapshot 如果不是這張卡的權益內容（例如錯誤頁、首頁、其他卡），**不要建立或修改資料**，在摘要中說明。
- 需要新增商家時，同步更新 `data/merchants.json`；需要新增支付方式或類別時，更新 `data/categories.json`。
- 執行 `npm run validate-cards`，有錯誤就修正，直到沒有錯誤。
- 不要修改 `snapshots/`、`data/sources.json`、`src/`、`.github/` 裡的檔案。

最後把摘要**附加**到 `.update-summary.md`（繁體中文、Markdown）：

```
## <銀行> <卡名>（新增／更新）
- 主要權益或改了什麼（例如：超市回饋 3% → 2%，11/1 起）
- 原文依據：引用 snapshot 中的關鍵句子
- 不確定、需要人工確認的地方
```

沒有建立或修改 JSON 的卡片，也要在摘要中寫一行說明原因。
