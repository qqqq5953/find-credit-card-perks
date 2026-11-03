# 刷哪張卡最划算 — LINE Bot

在 LINE 輸入「全聯 800」，Bot 會從你持有的信用卡中，找出回饋最多的一張。銀行權益有變動時，系統會自動偵測，並通知持有該卡的人。

## 功能

- **設定我的卡片**：在 LINE 裡開啟 LIFF 頁面，點選持有的卡片；權益可切換的卡（例如 CUBE）可以設定目前的方案。
- **查詢**：輸入「全聯 800」、「Uber Eats」、「LINE Pay 全聯 300」、「日本 5000」，或點類別按鈕。回覆前 3 名的卡、回饋率、預估回饋金額和注意事項。切換型的卡如果換方案會更划算，也會提示。
- **權益變動偵測**：GitHub Actions 每天抓取權益頁面並比對。有變動時，Claude Code（Pro 訂閱）會更新卡片資料並開 PR，同時用 LINE 通知管理者。
- **推播給持卡人**：PR merge 後自動部署，並把變動內容推播給持有該卡、且開啟通知的使用者。
- 其他指令：`我的卡片`、`說明`、`關閉通知`、`開啟通知`。

## 專案結構

```
data/
  cards/*.json          每張卡的權益資料（schema：data/schema/card.schema.json）
  categories.json       消費類別與支付方式
  merchants.json        商家 → 類別對照表
  sources.json          每張卡要抓取的權益頁面
snapshots/              上次抓到的權益原文（比對變動用）
prompts/
  extract-card.md       把權益原文整理成 JSON 的 prompt（貼到 Claude 網頁版使用）
  update-card.md        GitHub Actions 中 Claude Code 自動更新資料用的 prompt
src/
  index.ts              Worker：/webhook、/api/*、/internal/notify
  engine/               輸入解析、回饋計算、資料變動比對（純函式）
  line/                 LINE 簽章驗證、API client、訊息模板
  repo.ts               D1 資料存取
public/liff/            卡片設定頁
scripts/                資料驗證、抓取頁面、比對變動、通知管理者
.github/workflows/      CI、每日偵測變動、部署與推播
```

## 常用指令

```bash
npm test                # 單元測試
npm run validate-cards  # 檢查卡片資料格式，並列出即將到期的規則
npm run fetch-sources   # 抓取權益頁面並比對 snapshots/
npm run diff-cards -- --base HEAD~1   # 比對卡片資料變動
npm run dev             # 本機啟動 Worker
```

申請帳號、設定金鑰和部署方式見 [SETUP.md](SETUP.md)。

## 新增一張卡

**自動（建議）**：在 `data/sources.json` 加一筆，網址不知道可以留空：

```json
{ "card_id": "bank-card", "bank": "銀行名稱", "name": "卡名", "url": "", "type": "html", "selector": "body" }
```

下一次「偵測權益變動」執行時，Claude 會搜尋官方網址，並檢查細節是否寫在子頁面（例如各個活動的詳情頁）。需要的話會設定 `follow_links`，讓程式把這些連結一起點進去抓。接著抓取權益頁面、建立 `data/cards/<card_id>.json`，然後開 PR 給你確認。

`follow_links` 是一個 CSS selector，例如 `a[href*='Activity']`；`null` 代表不需要點進子頁面；沒有這個欄位代表還沒確認。

**手動**：把 `prompts/extract-card.md`、`data/schema/card.schema.json`、`data/categories.json`、`data/merchants.json` 和權益全文貼到 Claude 網頁版，把輸出存成 `data/cards/<card_id>.json`，再執行 `npm run validate-cards`。

確認數字和官網一致後，把 `verified` 改成 `true`。卡面圖片（選用）放在 `public/cards/`，並在 JSON 的 `image` 欄位填檔名。

## 目前收錄的卡片

第一銀行（綠活卡、iLEO、宜蘭認同卡）、聯邦銀行（賴點卡、幸福M卡）、兆豐銀行（Gogoro 聯名卡）、永豐銀行（幣倍卡）、國泰世華（CUBE）、星展銀行（eco 永續卡）。

> ⚠️ 目前只有國泰 CUBE 有資料，而且是**示意用的範例數字**（`verified: false`）。其他卡片會在啟用自動化後，由 Claude 從官網原文建立。

## 計算方式

- 每條規則的 `rate` 是符合條件時的總回饋率（含基本回饋）。
- 同一張卡有多條規則符合時，取回饋最多的一條。
- 超過上限的部分，只算基本回饋。
- 點數或哩程依 `reward_unit.twd_value` 換算成台幣後再比較。
- 已過期的規則不列入計算。
- 沒有輸入金額時，以 1,000 元試算。
- 目前**不會記錄**本月已累積的回饋，所以「上限已用掉多少」不在計算範圍內。
