# 找出信用卡的官方權益頁面（GitHub Actions 中的 Claude Code 使用）

`data/sources.json` 裡有些卡片的 `url` 是空字串，請幫每一張找出**銀行官網**上介紹這張卡權益的頁面網址並填入。

## 規則

1. 只能使用**發卡銀行自己的網域**（例如 firstbank.com.tw、ubot.com.tw、megabank.com.tw、sinopac.com、cathaybk.com.tw、dbs.com.tw 及其子網域）。不要使用比較網站、新聞或部落格的網址。
2. 優先選擇：卡片介紹頁（列出回饋率、上限、活動期間的那一頁）> 當期權益活動頁 > 權益說明 PDF。
   - 如果是 PDF，把 `type` 改成 `"pdf"`。
3. 用 WebSearch 找候選網址後，用 WebFetch 打開確認：頁面確實是這張卡，而且內容有回饋或權益說明。
4. 能判斷權益正文所在的區塊時，把 `selector` 改成比 `body` 更精確的 CSS selector（例如 `main`、`#content`）；不確定就維持 `body`。
5. 找不到可信的官方網址就**維持空字串**，不要亂填。
6. 只修改 `data/sources.json` 中 `url` 為空字串的項目的 `url`、`type`、`selector`，不要動其他欄位或其他檔案。

最後把結果附加到 `.update-summary.md`（繁體中文）：

```
## 補上官方權益網址
- <銀行> <卡名>：<網址>（或：找不到，原因）
```
