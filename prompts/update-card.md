# 自動更新卡片資料（GitHub Actions 中的 Claude Code 使用）

信用卡權益頁面有變動。變動的卡片 ID：{{CHANGED}}

請依序處理每一張卡：

1. 用 `git diff HEAD -- snapshots/<卡片ID>.txt` 查看權益原文**改了什麼**，並讀取完整的 `snapshots/<卡片ID>.txt`。
2. 讀取 `data/cards/<卡片ID>.json`，依照 `prompts/extract-card.md` 的規則更新：
   - 只修改原文確實改變的部分，**沿用既有的方案 ID 和規則 ID**。
   - 如果變動只是文案、排版、與回饋無關的內容，就不要修改 JSON。
   - 修改後把 `verified` 設為 `false`、`updated_at` 設為今天。
3. 需要新增商家時，同步更新 `data/merchants.json`。
4. 執行 `npm run validate-cards`，有錯誤就修正，直到沒有錯誤。

最後把變動摘要寫到 `.update-summary.md`（繁體中文、Markdown），格式：

```
## <銀行> <卡名>
- 改了什麼（例如：超市回饋 3% → 2%，11/1 起）
- 原文依據：引用 snapshot 中的關鍵句子
- 不確定、需要人工確認的地方
```

沒有修改任何 JSON 的卡片，也要在摘要中寫一行說明原因。不要修改 `snapshots/`、`src/` 或 `.github/` 裡的檔案。
