# Worker brief：CreditRoll Live Web UI Redesign (Opus 5.5 Max) / paypal-credit-roll-live

你是 `/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/.claude/worktrees/opus-credit-roll-ui` 裡的完整 Claude Code session（`opus[1m]`, `effort: max`），這個 repo 的 hook、skill 與 settings 對你生效。派工的是另一個 session（main），它不在這個 worktree 裡；使用者本人也可能直接在這個視窗打字。

## 任務

為 **PayPal AI Hackathon 2026（總獎金 US$67,500）** 的參賽作品 **`CreditRoll Live — Interactive Cinema End-Credits & PayPal Sandbox Settlement Studio`** 重新設計並實作世界級、具備博物館與獨立電影工業質感的網頁 UI（包含首頁 `app/page.tsx`、Dashboard 外殼與導覽、以及兩顆核心 AG Studio 3.0 自訂元件 `app/dashboard/studio/credit-roll-widgets.tsx`），並同時修復既有 7 個 `react-doctor` 警告，讓 `npx -y react-doctor@latest . --offline --verbose` 達到 **90～100 / 100 Great**，最後擷取 3 張高解析度 Playwright 實機截圖寫入 `docs/media/` 與 `README.md`。

## 互動規則

- 這是一次獨立完整的 UI 美學重製與品質升級任務，不需要停下問問題，請直接規劃並一路做到驗證全綠與 commit 完成。
- 以 `[main]` 開頭的訊息是 main 轉達的；其中標「以下為使用者原話」的段落才是使用者裁決，其餘是 main 的判讀。沒有前綴的訊息是使用者本人打的。
- 要宣稱「使用者已同意 X」之前，先在對話裡找到人打的那一句；找不到就把 X 列成待拍板。
- 完成後回報一次。回報要含：
  1. 設計概念與前後視覺差異說明
  2. `node --test tests/*.test.ts`（17/17 pass）、`npx tsc --noEmit`、`npm run build`、`npx -y react-doctor@latest . --offline --verbose` 分數與輸出
  3. 3 張全新 Playwright 實機截圖路徑（`docs/media/05-screening-room-home.png`、`docs/media/06-ag-studio-credit-roll-stage.png`、`docs/media/07-ghost-patchbay-and-receipts.png`）
  4. Commit SHA 與沒做的部分

## 邊界與絕對不可破壞的契約（Hard Contracts）

- **不 push、不開 PR、不 rebase、不 amend**（commit 在當前 worktree 分支 `feat/opus-credit-roll-ui` 即可）。
- **嚴禁跑 `pkill -f chrom` 或 `killall Google Chrome`**（會殺掉使用者日常 Chrome 與其他背景任務）。若使用 Playwright 截圖，請指定本機快取的 headless shell：
  `/Users/linhancheng/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell`
  並在使用自開的 `next dev` / `next start` port（如 `3456`）截完圖後只 kill 該 port 的 server PID。
- **注意 Next 16 `AGENTS.md` / `CLAUDE.md`**：`next dev` 啟動時若變更或生成無關檔案，commit 前請確認 `git status` 乾淨。
- **100% 保留既有測試與 AG Studio 契約（`tests/ticket-01*.test.ts`, `tests/ticket-02*.test.ts`, `tests/ticket-03*.test.ts` 共 17 條測試必須全過）**：
  - 保留 `CreditRollStageWidget` 與 `GhostPatchbayWidget` 的匯出名稱與 props 簽章（`params: AgWidgetParams`）。
  - 保留所有既有 `data-testid` 與 `data-*` 屬性：
    - `data-testid="credit-roll-stage-widget"`
    - `data-testid="cut-toggle-v1"`, `data-testid="cut-toggle-v2"`, `data-testid="toggle-roll-motion"`, `data-testid="clear-cross-filter"`
    - `data-testid={`contributor-chip-${node.personId}`}`, `data-badge-status={node.badgeStatus}`, `data-ghost={node.isTranslucentGhost ? 'true' : 'false'}`
    - `data-testid={`ghost-callout-${node.personId}`}`
    - `data-testid="ghost-patchbay-widget"`, `data-testid="patchbay-proposal-hash"`
    - `data-testid="patchbay-error-banner"`, `data-testid="patchbay-inflight-banner"`, `data-testid="patchbay-approval-checkbox"`
    - `data-testid="btn-supporter-order"`, `data-testid="btn-obligation-invoice"`, `data-testid="btn-batch-settlement"`
    - `data-testid="receipt-supporter-order"`, `data-testid="receipt-obligation-invoice"`, `data-testid="invoice-qr-image"`, `data-testid="receipt-batch-settlement"`, `data-testid={`batch-item-status-${item.personId}`}`
  - 保留 `app/dashboard/studio/initial-report.ts`、`app/dashboard/reports-store.ts`、`app/dashboard/studio/credit-roll-widget-state.ts`、`app/dashboard/studio/ai.ts` 的公開介面與測試預期行為。
- **手動截圖與驗收收據**放 `/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/.scratch/credit-roll-live/dispatch-opus-ui/receipts/`；要 commit 進 repo 展示於 `README.md` 的 3 張 UI 截圖放 `docs/media/05-screening-room-home.png`、`docs/media/06-ag-studio-credit-roll-stage.png`、`docs/media/07-ghost-patchbay-and-receipts.png`。

## 脈絡

- 規格：`/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/.scratch/credit-roll-live/spec.md`
- 使用者原話（逐字）：
  - 以下為使用者原話：「這場有網頁嗎？網頁也要用opus做，總之我不信任argon的美感」
  - 以下為使用者原話：「B」（選擇：在 11/12 截稿前，派 `Opus 5.5 Max` 把第 3 場 PayPal CreditRoll Live 的網頁 UI 也重製升級）
  - 以下為使用者原話：「允許這次派工」
- main 的判讀（不是裁決）：
  1. **目前 UI 的痛點**：
     - 首頁 `app/page.tsx` 目前還停留在 PayPal 官方 starter 模板的極簡連結列表（`PayPal REST APIs with AG Grid & AG Studio`），完全沒有展現 **CreditRoll Live** 的主題、電影剪輯問題意識（Rough Cut v1 vs Director's Cut v2 的 `UNPAID_GHOST` 幽靈剪輯欠款陷阱）、也沒有引導評審直接進入 `/dashboard` 或體驗互動對帳。
     - `app/dashboard/studio/credit-roll-widgets.tsx` 的兩顆自訂元件（`CreditRollStageWidget` 與 `GhostPatchbayWidget`）目前只是用普通 Tailwind `bg-slate-950`、`bg-slate-900`、`bg-cyan-500` 排出的標準深色小卡片，缺乏真正的「**35mm 電影暗房剪輯台（Steenbeck Flatbed / Cue Sheet Splice Tape）× PayPal 雙聯金流清算帳冊（Completion Bond & Ledger Voucher）**」的工藝感、字體層次與材質對比。
     - `npx -y react-doctor@latest . --offline --verbose` 目前只有 `70 / 100 Needs work`（7 個 warnings，分布在 `app/dashboard/components/dialogs.tsx:78,93`、`app/dashboard/components/report-header.tsx:114,115`、`app/dashboard/components/ui/ui.tsx:67`）。
  2. **美學與功能升級要求**：
     - **A. 首頁 `app/page.tsx` — "The Completion Bond & 35mm Cue Sheet Dossier"**：
       - 將 `/` 打造成極具視覺張力的電影製片結算檔案館首頁（Editorial Film Dossier + Live Interactive Preview / Launchpad to `/dashboard`），清楚呈現三大痛點（Ghost Credit Cut Trap、Stage-Name Alias Mismatch、PayPal Two-Way Read-Back Loop）、6 位劇組人員（`DJ Owl`, `Moth`, `Nyx Frame`, `Elena Rostova`, `Hana Sato`, `Alex Rivera`）的 Rough Cut v1 vs Director's Cut v2 對照表、一鍵進入 `/dashboard`（AG Studio 完整工作台）的醒目入口，並保留通往 `/products`、`/plans`、`/invoices`、`/transactions`、`/balances` 5 個 PayPal REST API 端點頁的清晰導覽。
     - **B. AG Studio 兩顆核心 Widget（`app/dashboard/studio/credit-roll-widgets.tsx`）與主題外殼（`app/globals.css`, `app/dashboard/components/*`, `app/dashboard/studio/theme.ts`）**：
       - **`CreditRollStageWidget`（35mm 暗房膠卷片尾放映台）**：加入沖印齒孔（Sprocket Perforations）、SMPTE 時碼尺標（Timecode Ruler `01:58:12:04`）、Rough Cut `v1`（青色工作拷貝 Workprint）↔ Director's Cut `v2`（琥珀色剪接膠帶 Splice Tape）切換器、以及當 `Moth` 與 `Nyx Frame` 在 `v2` 被剪掉時浮現的半透明幽靈膠片印記（`UNPAID_GHOST · Removed from Cut v2 · Contract Fee Still Owed`）。
       - **`GhostPatchbayWidget`（雙聯製片清算插線盤 & PayPal Sandbox Read-Back 憑證台）**：呈現整數美分鎖定帳本（`$7,050.00 Executable` vs `$3,000.00 Ghost-Cut Retained` vs `Alex Rivera NEEDS_REVIEW Hold`）、製片人核准保險栓（Checkbox Gate）、三顆雙向 PayPal Sandbox 動作鍵（`1. BTS Order ($25.00)`、`2. Ghost Invoice + QR`、`3. Settle Crew Payouts`），以及回讀憑證（Order ID、Invoice QR 票根、Batch Payout 逐筆 `SUCCESS / PENDING / UNCLAIMED / FAILED` 印記）。
     - **C. 修復 React Doctor 全部警告**：
       - 修掉 `dialogs.tsx`、`report-header.tsx`、`ui/ui.tsx` 的 7 個 warnings，且新寫的元件零新增 warning，讓 `npx -y react-doctor@latest . --offline --verbose` 達到 **90～100 / 100 Great**。
     - **D. 擷取 3 張 1440×900 高解析度截圖並更新 `README.md`**：
       - `docs/media/05-screening-room-home.png`（全新首頁 `/`）
       - `docs/media/06-ag-studio-credit-roll-stage.png`（`/dashboard` 切到 Director's Cut `v2` 顯示 `UNPAID_GHOST` 與 AG Grid 聯動）
       - `docs/media/07-ghost-patchbay-and-receipts.png`（`/dashboard` 觸發完 BTS Order、Ghost Invoice + QR、Batch Payouts 後的回讀收據與 QR Code 畫面）
       - 在 `README.md` 新增一個視覺畫廊段落展示這 3 張介面截圖。
