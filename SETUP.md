# 設定與部署

程式碼中沒有任何金鑰。所有機密值都從環境變數或 secret 讀取，照下面的步驟申請後填入即可。

| 名稱 | 用途 | 本機（`.dev.vars`） | Cloudflare（`wrangler secret put`） | GitHub Secrets |
|---|---|:-:|:-:|:-:|
| `LINE_CHANNEL_SECRET` | 驗證 webhook | ✅ | ✅ | |
| `LINE_CHANNEL_ACCESS_TOKEN` | 回覆／推播訊息 | ✅ | ✅ | ✅（通知管理者用） |
| `LIFF_ID` | 卡片設定頁 | ✅ | ✅ | |
| `LINE_LOGIN_CHANNEL_ID` | 驗證 LIFF 登入 | ✅ | ✅ | |
| `NOTIFY_SECRET` | 保護 `/internal/notify` | ✅ | ✅ | ✅ |
| `ADMIN_LINE_USER_ID` | 你自己的 LINE user ID，接收變動通知 | | | ✅ |
| `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` | GitHub Actions 自動部署 | | | ✅ |
| `CLAUDE_CODE_OAUTH_TOKEN` | GitHub Actions 中用 Claude Pro 更新資料 | | | ✅ |
| `WORKER_URL`（**Variables**，不是 Secrets） | 例如 `https://find-credit-card-perks.xxx.workers.dev` | | | ✅ |
| `ENABLE_AUTOMATION`（**Variables**） | 設為 `true` 才會啟用每日偵測和自動部署 | | | ✅ |

---

## 1. LINE 官方帳號與 Messaging API

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立 Provider。
2. 在 Provider 底下建立 **Messaging API channel**（會同時建立 LINE 官方帳號）。
3. **Basic settings** → 複製 `Channel secret` → `LINE_CHANNEL_SECRET`。
4. **Messaging API** → 最下方發行 `Channel access token (long-lived)` → `LINE_CHANNEL_ACCESS_TOKEN`。
5. 到 [LINE Official Account Manager](https://manager.line.biz/) → 設定 → 回應設定：關閉「自動回應訊息」，開啟「Webhook」。
6. Webhook URL 等部署完成後再填（步驟 4）。

## 2. LIFF（卡片設定頁）

1. 在**同一個 Provider** 底下建立 **LINE Login channel**。
   > 一定要和 Messaging API channel 在同一個 Provider，否則 LIFF 拿到的 user ID 會和 Bot 收到的不一樣。
2. **Basic settings** → 複製 `Channel ID` → `LINE_LOGIN_CHANNEL_ID`。
3. **LIFF** 分頁 → Add：
   - Size：`Tall`
   - Endpoint URL：`https://<你的 Worker 網址>/liff/`（可以先填暫時的網址，部署後再改）
   - Scopes：勾選 `openid`、`chat_message.write`（儲存後會在聊天室送出「已設定 N 張卡片」）
4. 複製 LIFF ID → `LIFF_ID`。
5. 把 LINE Login channel 的狀態從 `Developing` 改成 `Published`，朋友才能使用。

## 3. Cloudflare

```bash
npx wrangler login
npx wrangler d1 create perks-db       # 把輸出的 database_id 填進 wrangler.toml
npm run db:migrate:remote
npm run deploy                        # 會顯示 Worker 網址

# 逐一設定 secret（會提示你貼上數值）
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LIFF_ID
npx wrangler secret put LINE_LOGIN_CHANNEL_ID
npx wrangler secret put NOTIFY_SECRET    # 自己產生：openssl rand -hex 32
```

GitHub Actions 自動部署需要的 API token：Cloudflare Dashboard → My Profile → API Tokens → 用「Edit Cloudflare Workers」範本建立，並加上 `D1: Edit` 權限 → `CLOUDFLARE_API_TOKEN`。Account ID 在 Workers 頁面右側 → `CLOUDFLARE_ACCOUNT_ID`。

## 4. 接上 LINE

1. Messaging API channel → Webhook URL 填 `https://<Worker 網址>/webhook` → 按 Verify → 開啟 Use webhook。
2. LIFF 的 Endpoint URL 改成 `https://<Worker 網址>/liff/`。
3. Rich Menu（選用）：在 LINE Official Account Manager → 圖文選單，建立一個按鈕，動作選「連結」，填 `https://liff.line.me/<LIFF_ID>`。
4. 用手機加 Bot 好友 → 設定卡片 → 輸入「全聯 800」測試。

## 5. 自動偵測權益變動（GitHub Actions + Claude Pro）

> 「偵測權益變動」和「部署並通知持卡人」這兩個 workflow **預設是停用的**，執行時會顯示為 skipped，不會寄失敗通知信。
> 完成下面所有設定後，再到 Settings → Secrets and variables → Actions → **Variables** 新增 `ENABLE_AUTOMATION`，值填 `true`，就會啟用。想暫停時，把它改成 `false` 或刪除即可。

1. 在你的電腦執行 `claude setup-token`（需要先安裝 Claude Code 並用 Pro 帳號登入），複製產生的 token → GitHub Secret `CLAUDE_CODE_OAUTH_TOKEN`。
2. 取得你自己的 LINE user ID：Messaging API channel → Basic settings 最下方的 `Your user ID` → `ADMIN_LINE_USER_ID`。
3. GitHub repo → Settings → Actions → General → Workflow permissions：選 **Read and write permissions**，並勾選 **Allow GitHub Actions to create and approve pull requests**。
4. GitHub repo → Settings → Secrets and variables → Actions：填入上表的 Secrets，以及 Variable `WORKER_URL`。
5. Actions 分頁 → 「偵測權益變動」→ Run workflow，手動跑一次：
   - 第一次執行會建立「新增權益快照」的 PR，把各卡片頁面存成比對基準，merge 即可。
   - 之後每天自動執行；有變動時，Claude 會更新 `data/cards/` 並開 PR，同時用 LINE 通知你。
6. 確認 PR 內容正確後 merge → 「部署並通知持卡人」workflow 會自動部署，並推播給持有該卡的使用者。

> 由 Actions 建立的 PR 不會再觸發 `CI` workflow（GitHub 的限制），所以「偵測權益變動」workflow 已經在建立 PR 前跑過測試和資料驗證，結果會寫在 PR 說明的最後。

## 本機開發

```bash
npm install
cp .dev.vars.example .dev.vars        # 填入數值；只測試邏輯的話，可以隨便填
npm run db:migrate:local
npm run dev                           # http://localhost:8787
```

要讓手機上的 LINE 連到本機：`npx cloudflared tunnel --url http://localhost:8787`，再把產生的網址暫時填進 Webhook URL 和 LIFF Endpoint URL。
