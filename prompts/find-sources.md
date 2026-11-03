# 設定信用卡權益頁面的抓取方式（GitHub Actions 中的 Claude Code 使用）

請檢查 `data/sources.json`，處理以下兩種卡片：

- **A. `url` 是空字串**：找出官方權益頁面網址並填入，接著也要做 B。
- **B. 沒有 `follow_links` 欄位**：確認權益細節是不是寫在子頁面，設定 `follow_links`。

## A. 找官方網址

1. 只能使用**發卡銀行自己的網域**（例如 firstbank.com.tw、ubot.com.tw、megabank.com.tw、sinopac.com、cathaybk.com.tw、dbs.com.tw 及其子網域）。不要使用比較網站、新聞或部落格的網址。
2. 優先選擇：卡片介紹頁（列出回饋率、上限、活動期間的那一頁）> 當期權益活動頁 > 權益說明 PDF。如果是 PDF，把 `type` 改成 `"pdf"`。
3. 用 WebSearch 找候選網址後，用 WebFetch 打開確認：頁面確實是這張卡，而且內容有回饋或權益說明。
4. 找不到可信的官方網址就**維持空字串**，不要亂填，也不用做 B。

## B. 設定要點進去的子頁面（follow_links）

用 WebFetch 打開 `url`，判斷回饋率、上限、活動期間等細節是在這一頁，還是要點進「活動詳情」、「活動辦法」、「權益說明」等連結才看得到。

- **細節都在這一頁**：設定 `"follow_links": null`。
- **細節在子頁面**：設定 `follow_links` 為一個 CSS selector，選出那些連結。
  - 你看到的是轉換後的文字，看不到 HTML 結構，所以請用**網址的共同特徵**寫 selector，例如 `a[href*='Activity']`、`a[href*='cid=1565'][href*='Promotion']`、`a[href$='.pdf']`；多個條件用逗號分隔。
  - 目標是選到**這張卡的權益與活動連結**，避免選到選單、其他卡片、申辦表單、社群連結。程式只會跟隨同一家銀行網域的連結，最多 15 個。
  - 新的活動通常會用相同格式的網址出現，selector 要寫得能涵蓋未來新增的活動。
  - 子頁面只需要某個區塊時，可以加 `follow_selector`（預設 `body`）。
- 能判斷權益正文所在的區塊時，把 `selector` 改成比 `body` 更精確的 CSS selector（例如 `main`）；不確定就維持 `body`。

## 限制

只修改 `data/sources.json` 中需要處理的項目的 `url`、`type`、`selector`、`follow_links`、`follow_selector`，不要動其他欄位或其他檔案。

最後把結果**附加**到 `.update-summary.md`（繁體中文）：

```
## 抓取設定
- <銀行> <卡名>：<網址>；子頁面：<selector 與原因，或「不需要」>（或：找不到網址，原因）
```
