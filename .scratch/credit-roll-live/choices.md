# CreditRoll Live — 實作決定帳本（auto-choice）

## Pass 1 — `bdc51cd`..`c8f47fc`（Tickets 01–03）

### 八類掃描總覽

1. **資料形狀與格式**：有（見決定 C1：結構化識別碼取代加密內容雜湊、決定 C2：內建 6 位劇組人員之預設劇本資料集）
2. **存放位置與命名**：有（見決定 C3：伺服器端結算紀錄採進程內記憶體單例 `defaultStore`）（其餘內部變數命名與純外觀樣式合併計數：共 4 處）
3. **API 契約與錯誤行為**：有（見決定 C4：PayPal `POST` 寫入僅在 `401` 過期時重試 1 次，對 `429`/`5xx` 不自動重試而交由呼叫端以相同 `PayPal-Request-Id` 重送）
4. **新增的相依套件，連同它帶進來的預設行為與上限**：無（零新增 `package.json` 第三方套件，完全沿用既有 `next@16.3.6`、`ag-studio@3.0.0` 與 Node.js 24 內建 `node:test`）
5. **並行與效能取捨：快取、容量上限、逾時、重試**：有（見決定 C4：非冪等風險下的寫入重試策略）
6. **範圍解讀：套用範圍比規格寬或窄**：有（見決定 C5：Widget 面板在未配置 `.env.local` PayPal 憑證時提供本地決定性預覽，而伺服器 API route 維持嚴格要求真實憑證或注入之 `fetchImpl`）
7. **測試設定改動：timeout、skip、mock、放寬斷言**：有（見決定 C6：在 `ticket-03` 測試中透過 `module.registerHooks` 將 JSX `.tsx` 與 `@/` 路徑別名轉交 TypeScript strip-types 載入）
8. **之後的程式會照抄的模式**：有（見決定 C7：以 `useSyncExternalStore` 連接 `creditRollInteractiveStore` 跨 Custom Widget 與 `AgStudio` 資料源同步狀態）

---

### 逐條決定明細

#### C1 — 以結構化組合鍵取代 SHA-256 產生 `proposalVersionHash` 與 `ApprovalToken`
- **何時**：Commit `bdc51cd`（Ticket 01，`lib/credit-roll-reconciler.ts:864-891`）
- **決定**：
  - **標題**：使用人類可讀的結構化組合字串（如 `CRLIVE-NEON-NOCTURNE-V2-REV1-P-IRIS:185000|P-MOTH:140000-TOTAL665000`）作為提案版本識別碼（`proposalVersionHash`）與核准權杖（`APPROVAL::<proposalVersionHash>::<approver>`）。
  - **觸發事件**：當對帳引擎計算完可執行撥款名單、需要簽發防止重複撥款或竄改金額的提案版本鍵時觸發。
  - **現在怎麼做**：將專案代號、剪輯版本（`v1`/`v2`）、修訂號、排序後的 `personId:amountCents` 清單與總美分金額直接串接為固定格式字串（出處：`lib/credit-roll-reconciler.ts:864`）。
  - **沒選的做法會怎樣**：若呼叫 `node:crypto` 的 `createHash('sha256')` 計算內容雜湊，會直接違反使用者全域 `CLAUDE.md` 與 `harness-trust-binding`「不計算、不儲存內容 hash（sha256/md5）」的硬規定，且除錯時無法從字串一眼看出該版本包含哪幾筆金額。
- **規格缺口**：`spec.md` 寫明 `proposalVersionHash` 名稱，但未指定其字串生成演算法。
- **影響範圍**：`lib/credit-roll-reconciler.ts:864-915`、`lib/credit-roll-settlement.ts` 與測試斷言皆依賴此格式。
- **判定**：`sound` — 同時滿足決定性防竄改要求與全域零內容雜湊規範，且具備直觀可讀性。
- **把握度**：高

#### C2 — 內建 6 位劇組人員（含 2 位版本幽靈、2 位藝名映射、1 位撞名待審）的預設電影資料集 `DEFAULT_CREDIT_ROLL_SCENARIO`
- **何時**：Commit `bdc51cd`（Ticket 01，`lib/credit-roll-reconciler.ts:225-360`）
- **決定**：
  - **標題**：在 `DEFAULT_CREDIT_ROLL_SCENARIO` 內建一部獨立短片《Neon Nocturne》的 6 位劇組人員、v1/v2 兩版片尾與合約名冊。
  - **觸發事件**：當使用者打開 `/dashboard` 或執行對帳而未手動上傳外部 JSON 劇本時觸發。
  - **現在怎麼做**：預先配置 2 位正常署名人員（`DJ Owl` 藝名映射、`Sora Vance`）、2 位在 Cut v2 被刪鏡頭但保留應付合約的幽靈人員（`Moth` $1,400、`Nyx Frame` $2,200）、1 位撞名歧義人員（`Alex Rivera` 攔截為 `NEEDS_REVIEW`）與 1 位未核准合約人員（出處：`lib/credit-roll-reconciler.ts:225`）。
  - **沒選的做法會怎樣**：若預設為空白陣列，評審或使用者一打開 AG Studio 畫布只會看到空白片尾，無法在 15 秒內直接體驗 Cut v1/v2 幽靈切換與藝名攔截。
- **規格缺口**：`spec.md` 點名了 `DJ Owl` 與 `Moth` 例子，但未給出完整種子劇組名單與金額。
- **影響範圍**：`lib/dashboard-data.ts`、AG Studio 預設報表顯示與 Demo 影片錄製劇本。
- **判定**：`sound` — 一套種子資料同時覆蓋全部 6 條驗收情境，開箱即可互動。
- **把握度**：高

#### C3 — 伺服器端結算狀態採用進程內記憶體 Store（`createSettlementStore`）而非外部資料庫
- **何時**：Commit `84bd773`（Ticket 02，`lib/credit-roll-settlement.ts:220-303`）
- **決定**：
  - **標題**：以模組級記憶體單例 `defaultStore` 保存已執行的 `proposalVersionHash` 批次收據與更新後的劇組結算狀態。
  - **觸發事件**：當 `/api/credit-roll/settle`、`/api/credit-roll/supporter-order` 或 `/api/credit-roll/obligation-invoice` 完成 PayPal Sandbox 寫入與 `GET` 查回時觸發。
  - **現在怎麼做**：將收據與冪等鍵存於記憶體 `Map` 中，並在每次重送相同 `proposalVersionHash` 時直接回傳既有收據（出處：`lib/credit-roll-settlement.ts:220`）。
  - **沒選的做法會怎樣**：若引入 SQLite 或外部 DB，會增加環境建置與檔案鎖定複雜度；而若完全不存狀態，則無法跨兩次 HTTP POST 請求驗證 `proposalVersionHash` 冪等防重。
- **規格缺口**：`spec.md` 要求阻擋重複提交同一 `proposalVersionHash`，但未指定持久化儲存媒介。
- **影響範圍**：`/api/credit-roll/*` 路由在單一 Next.js server process 生命週期內的冪等記憶。
- **判定**：`sound` — 對齊官方 `hackathon-paypal-ag-grid-boilerplate` 無外部 DB 的輕量設計，且足以完整驗證冪等防重。
- **把握度**：高

#### C4 — PayPal `POST` 寫入僅在 `401` token 過期時重試 1 次，對 `429`/`5xx` 不自動重試
- **何時**：Commit `84bd773`（Ticket 02，`lib/paypal.ts:169-205`）
- **決定**：
  - **標題**：在 `postJson` 與 `postRaw` 中強制要求傳入非空的 `PayPal-Request-Id`（冪等鍵：防止重複扣款的唯一請求編號），且僅在 HTTP `401`（OAuth token 過期）時清除快取重試 1 次，遇到 `429`/`5xx` 則立即拋出含 `debug_id` 的 `PayPalApiError`。
  - **觸發事件**：當伺服器呼叫 PayPal Sandbox `Orders`、`Invoicing` 或 `Payouts` 寫入端點遭遇錯誤時觸發。
  - **現在怎麼做**：不套用唯讀 `get()` 的 4 次指數退避迴圈，而是立即將錯誤與 `debug_id` 往上傳回並保持原結算狀態不變（出處：`lib/paypal.ts:169-205`）。
  - **沒選的做法會怎樣**：若直接複製 `get()` 的自動重試邏輯到所有 POST 端點（尤其像 `/v2/invoicing/invoices/{id}/send` 或 `/generate-qr-code` 這類對重試敏感的動作），可能造成重複寄信或在測試逾時情境下卡住呼叫端。
- **規格缺口**：`spec.md` 要求寫入帶 `PayPal-Request-Id` 並於非 2xx 時保留原狀態與回報 `debug_id`，未明訂底層 HTTP client 的重試次數。
- **影響範圍**：`lib/paypal.ts` 所有寫入 helper 的錯誤傳播行為。
- **判定**：`sound` — 符合金流寫入「寧可顯式失敗對帳、不隱式重送」的安全原則。
- **把握度**：高

#### C5 — Widget 互動狀態層（`runPatchbaySandboxAction`）支援注入或本地決定性預覽，而伺服器 API route 維持純真實 Sandbox 呼叫
- **何時**：Commit `84bd773` 與 `c8f47fc`（Tickets 02–03，`lib/credit-roll-settlement.ts:320-355`、`app/dashboard/studio/credit-roll-widget-state.ts:231-431`）
- **決定**：
  - **標題**：因 Ticket 02 的 `ticket-yagni` 審查要求伺服器端 `lib/credit-roll-settlement.ts` 移除無憑證模擬模式（只保留真實 PayPal Sandbox 呼叫），故將「未設定 `.env.local` 憑證時的決定性預覽回退」放在前端 Widget 狀態控制器 `runPatchbaySandboxAction` 中。
  - **觸發事件**：當使用者在瀏覽器點擊 Patchbay Widget 上的「執行批次撥款／產生 QR 發票／購買支持包」按鈕，而後端因尚未填入 `.env.local` 的 `PAYPAL_CLIENT_ID` 回傳憑證未設錯誤時觸發。
  - **現在怎麼做**：如果後端已配置 `.env.local` 真實 PayPal Sandbox 憑證，Widget 直接採用後端真實 PayPal API 回傳的 ID 與狀態；若後端回報尚未配置 `.env.local` 憑證，Widget 的 fallback executor 會產出明確標示的本地預覽收據與 SVG QR Code，確保本地畫面與跨表篩選仍可完整互動（出處：`app/dashboard/studio/credit-roll-widget-state.ts:231-431`）。
  - **沒選的做法會怎樣**：若前端也不做無憑證回退，在尚未登入 PayPal 填入 `.env.local` 前，瀏覽器點擊任何按鈕都會直接卡在紅字錯誤，無法預覽 `PAID`/`PENDING`/`UNCLAIMED` 徽章變化與 QR Code 顯示；反之若完全不填真實憑證就交件，則不符合比賽真實 Sandbox 要求。
- **規格缺口**：Preflight 退路原則（`3a`）允許在取得憑證前先以決定性 fallback 跑通全套 UI，而 Ticket 02 YAGNI 審查要求後端模組只留純 Sandbox 路徑。
- **影響範圍**：`app/dashboard/studio/credit-roll-widget-state.ts:231-431`；正式錄製最終提交影片前若填入真實 `.env.local` 憑證，即自動走 100% 真實 PayPal Sandbox API。
- **判定**：`needs-user` — 暫定做法：維持「有 `.env.local` 憑證走 100% 真實 PayPal Sandbox API、無憑證時前端可預覽互動」；撤回方式：只要在 Chrome 的 `💳 PayPal Sandbox` 分頁登入並將 `PAYPAL_CLIENT_ID` 與 `PAYPAL_SECRET` 寫入 `.env.local`（或刪去 `credit-roll-widget-state.ts` 的 fallback 分支），即完全走真實 Sandbox。
- **把握度**：中

#### C6 — 在 `ticket-03` 測試檔頂部以 `node:module` 的 `registerHooks` 解析 `@/` 路徑別名與 `.tsx`
- **何時**：Commit `c8f47fc`（Ticket 03，`tests/ticket-03-ag-studio-widgets.test.ts:15-75`）
- **決定**：
  - **標題**：使用 Node.js 24 內建 `module.registerHooks` 在測試執行期解析 `@/*` import 別名與 `.tsx` 元件檔。
  - **觸發事件**：當以 `node --experimental-strip-types --test` 直接執行引用 Next.js `@/` 別名與 `.tsx` 檔案的 `tests/ticket-03-ag-studio-widgets.test.ts` 時觸發。
  - **現在怎麼做**：在測試檔開頭註冊輕量 resolve/load hook，將 `@/` 映射至專案根目錄並把 `.tsx` 轉譯為 JS，不修改正式產品程式碼、也不額外安裝 `vitest` 或 `tsx`（出處：`tests/ticket-03-ag-studio-widgets.test.ts:23`）。
  - **沒選的做法會怎樣**：Node.js 原生 `--experimental-strip-types` 預設不認得 `tsconfig.json` 的 `@/*` paths 與 `.tsx` 副檔名，若不加此 hook 就必須額外安裝第三方測試套件或把產品程式碼的 `@/` 全部改寫成相對路徑。
- **規格缺口**：`spec.md` 允許使用 `node --test`，未指定如何讓原生 Node test runner 解析 Next.js 的 `@/` 別名。
- **影響範圍**：僅限 `tests/ticket-03-ag-studio-widgets.test.ts`，零生產程式碼影響。
- **判定**：`sound` — 零依賴膨脹、完全隔離在測試檔內。
- **把握度**：高

#### C7 — 以 `useSyncExternalStore` 訂閱 `creditRollInteractiveStore` 同步 Custom Widget 與 AG Studio 資料表
- **何時**：Commit `c8f47fc`（Ticket 03，`app/dashboard/studio/credit-roll-widget-state.ts:445-475`、`app/dashboard/dashboard.tsx:99-112`）
- **決定**：
  - **標題**：透過 React 19 標準的 `useSyncExternalStore` 共享 `creditRollInteractiveStore`，讓 `CreditRollStageWidget`、`GhostPatchbayWidget` 與外層 `Dashboard` 的 `buildStudioData()` 即時同步結算狀態更新。
  - **觸發事件**：當使用者在 `GhostPatchbayWidget` 執行批次撥款或切換 Cut v1/v2，需要同時更新 `CreditRollStageWidget` 上的徽章與右側 AG Grid 的 `crewSettlements` 資料列時觸發。
  - **現在怎麼做**：由於 AG Studio 的 Custom Widget 渲染在獨立的面板樹內，無法直接從 `Dashboard` 傳遞自訂 React props，因此以輕量 external store 搭配 `useSyncExternalStore` 同步狀態（出處：`app/dashboard/dashboard.tsx:99-112`）。
  - **沒選的做法會怎樣**：若嘗試用 `useEffect` + `setState` 鏈式同步或透過 `window` 事件傳遞，會違反 `react.md` 的 `no-derived-useState` / `no-chain-state-updates` 規則並導致 AG Grid 資料表在撥款完成後不自動刷新。
- **規格缺口**：`spec.md` 要求 Widget 執行金流後同步更新 Widget 與 AG Grid，未指定跨 AG Studio 沙盒元件樹的 React 狀態通訊機制。
- **影響範圍**：`app/dashboard/dashboard.tsx`、`app/dashboard/studio/credit-roll-widgets.tsx` 與 `app/dashboard/studio/credit-roll-widget-state.ts`。
- **判定**：`sound` — 完美契合 React 19 與 `react-doctor` 100/100 規範，且與 `dashboard.tsx` 既有的 `useSyncExternalStore` 風格完全一致。
- **把握度**：高

---

## Pass 2 — Opus UI 重製（`feat/opus-credit-roll-ui`，base `40fcd50`，commit 前）

派工來源：`/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/.scratch/credit-roll-live/dispatch-opus-ui/brief.md`。出處行號以本 pass 的工作樹為準。

### 八類掃描總覽

1. **資料形狀與格式**：有（U1 首頁數字以 reconciler 為準、U2 金額千分位格式、U3 標題列時間改 UTC）
2. **存放位置與命名**：有（U13 `cr-*` 全域材質類別與 `--cr-*` token）；其餘合併計數 4 處：新檔 `lib/format-usd.ts`、`app/dossier.ts`、`app/credit-roll-wordmark.tsx`，以及主題匯出名 `agStudioPayPalTheme` 沿用舊名（現在已不是 PayPal 配色）以免改動 `dashboard.tsx` 的 import
3. **API 契約與錯誤行為**：有（U4 Dialog 修法與焦點行為、U8 清除篩選鍵移位與 `aria-pressed`）
4. **新增的相依套件，連同它帶進來的預設行為與上限**：有（U12 三套 Google 字型經 `next/font` 自架；`package.json` 零變動）
5. **並行與效能取捨：快取、容量上限、逾時、重試**：有（U14 首頁靜態預渲染、U15 常駐 CSS 動畫成本）
6. **範圍解讀：套用範圍比規格寬或窄**：有（U5 改 `initial-report.ts` 版面與 KPI 字型、U6 全 Studio 深色但端點頁不動、U7 Roll 只動齒孔不捲名單、U10 頂部列 persona 與 metadata、U11 截圖 07 未拍）
7. **測試設定改動：timeout、skip、mock、放寬斷言**：無（`tests/*.ts` 零變動；截圖腳本的 `reduced_motion` 屬截圖設定，不在測試套件內）
8. **之後的程式會照抄的模式**：有（U13 材質類別與 data 屬性配色、U2 `formatUsdCents`、U9 對外文案先對程式核實）

純外觀選擇（雙重曝光名字、膠帶、觀景窗框角、印章磨損遮罩、場記板條紋、檯燈光漸層、VFD 時碼光暈等）合併計數：約 12 處，不逐條列。

---

### 逐條決定明細

#### U1 — 首頁與 Patchbay 的數字一律由 reconciler 推導；與 brief 數字衝突時以資料為準
- **何時**：Pass 2（`app/dossier.ts:64`、`app/page.tsx` Hero 三個數字、`app/dashboard/studio/credit-roll-widgets.tsx:427`）
- **決定**：
  - **標題**：顯示 Ghost-cut retained **$3,600.00**，而非 brief 寫的 $3,000.00；首頁對照表列 6 份合約（含兩位 Alex Rivera），而非 brief 的「DJ Owl, Moth, Nyx Frame, Elena Rostova, Hana Sato, Alex Rivera」。
  - **觸發事件**：寫首頁數字時，用 `buildSettlementProposal()` 實算得到 `ghostCutObligationCents = 360000`（Moth $1,400 + Nyx Frame $2,200）；種子資料裡 Nyx Frame 就是 Elena Rostova 的藝名（同一份合約 CTR-2026-103），第六份合約是第二位 Alex Rivera（CTR-2026-202）。
  - **現在怎麼做**：純函式 `buildDossier()` 從 `DEFAULT_CREDIT_ROLL_SCENARIO` 推出首頁全部數字與對照表；Patchbay 的「Guardrail hold」名單也改由 `proposal.blockedItems` 推導，不再寫死「(Alex Rivera)」。
  - **沒選的做法會怎樣**：照 brief 寫死 $3,000.00，首頁會和 AG Studio 的 KPI、Patchbay、README 互相矛盾，評審一對數字就穿幫。
- **規格缺口**：brief「main 的判讀」段給了數字與名單但沒附來源，且與 `lib/credit-roll-reconciler.ts:218-393` 的種子資料不一致。
- **影響範圍**：首頁、Patchbay、README 畫廊文字；之後改種子資料時首頁自動跟著變。
- **判定**：`sound` — 同一份資料只能有一組數字；brief 該段明文是判讀、不是裁決。
- **把握度**：高

#### U2 — 金額一律顯示千分位（`$7,050.00`），以手寫分組取代 locale API
- **何時**：Pass 2（`lib/format-usd.ts:3`）
- **決定**：
  - **標題**：新增純函式 `formatUsdCents()`，取代 widget 內舊的 `$${(cents / 100).toFixed(2)}`。
  - **觸發事件**：舊格式輸出 `$7050.00`（沒有千分位），brief 的示意文字是 `$7,050.00`。
  - **現在怎麼做**：整數美分 → 手動補千分位逗號與兩位小數；兩顆 widget 與首頁共用。
  - **沒選的做法會怎樣**：用 `toLocaleString()`／`Intl.NumberFormat` 會被 react-doctor 的「render 中做 locale 格式化」規則抓，且伺服器與瀏覽器 locale 不同時輸出會不一致。
- **規格缺口**：brief 只給示意金額，沒規定格式化方式。
- **影響範圍**：之後所有新金額顯示都會照用這支函式；只支援 USD。
- **判定**：`sound` — 純函式、決定性、與 react-doctor 規則相容。
- **把握度**：高

#### U3 — 報表標題列的時間改成 UTC 顯示（原本是瀏覽器在地時間）
- **何時**：Pass 2（`app/dashboard/components/report-header.tsx:103-111`、`:126-127`）
- **決定**：
  - **標題**：tooltip 由在地時間改為「2026-11-05 12:45 UTC」，時鐘尚未就緒時顯示「12:45 UTC」，超過 24 小時改顯示 ISO 日期。
  - **觸發事件**：react-doctor 在 `report-header.tsx:114,115` 報 2 個「render 中做 locale/時區格式化」警告。
  - **現在怎麼做**：直接切伺服器給的 ISO 字串，不經任何 locale API；相對時間（just now／x min ago）不變。
  - **沒選的做法會怎樣**：照規則建議改成掛載後在 `useEffect` 格式化，可保留在地時間，但多一個 state 與一次重繪；若傳固定 locale＋`timeZone: 'UTC'` 則結果與現在等效。
- **規格缺口**：brief 只要求修掉警告，沒規定修完的顯示格式。
- **影響範圍**：使用者看到的「Updated …」tooltip 由在地時間變 UTC。
- **判定**：`sound` — 國際評審看 UTC 沒有歧義，且行為只影響 tooltip 與一瞬間的 fallback。
- **把握度**：中

#### U4 — Dialog 的 a11y 修法：標題當可存取名稱、點背景關閉改在 effect 掛監聽、表單改 React 19 `<form action>`、拿掉 autoFocus
- **何時**：Pass 2（`app/dashboard/components/ui/ui.tsx:75-85`、`app/dashboard/components/dialogs.tsx:81`）
- **決定**：
  - **標題**：修掉 react-doctor 在 `ui.tsx:67`（3 個）與 `dialogs.tsx:78,93`（2 個）的警告，不加任何 disable 註解。
  - **觸發事件**：brief 要求 react-doctor 達 90–100 分。
  - **現在怎麼做**：`<dialog>` 加 `aria-labelledby` 指向標題；點背景關閉的行為保留，但從 JSX `onClick` 改為 `useEffect` 裡的原生 `click` 監聽，鍵盤使用者用原生 Esc 關閉；建立報表表單改 `action={(formData) => …}`；拿掉 `autoFocus`，靠 `showModal()` 把焦點交給第一個可聚焦欄位（Playwright 實測：焦點落在 `#report-name` 且整段文字已選取，`selectionEnd = 15`）。
  - **沒選的做法會怎樣**：在 `<dialog>` 上加 `onKeyDown` 或假 `role` 只為過 lint，語意是錯的；加 `react-doctor-disable` 註解等於壓警告而不是修。
- **規格缺口**：brief 只說「修掉 7 個 warnings」，沒指定修法。
- **影響範圍**：之後新增的 dialog 都經過同一個 `Dialog` 元件。
- **判定**：`sound` — 行為等價且有實測；鍵盤路徑由原生 Esc 保證。
- **把握度**：中

#### U5 — 調整 `initial-report.ts`：CreditRoll 頁 KPI 7→6 格、放映台與插線盤 22→27 格、帳本表移到第 33 格；KPI 字型改 Archivo／Bodoni
- **何時**：Pass 2（`app/dashboard/studio/initial-report.ts:26-46`、`:125-131`）
- **決定**：
  - **標題**：加高兩顆自訂 widget、KPI 少一格；KPI 標題用 Archivo 13px、數字用 Bodoni 30px；雷達量表仍用原 PayPal 字型。
  - **觸發事件**：1440×900 且篩選面板展開時，每顆 widget 只有約 452×334px（Playwright 量測），放映台只露 2.5 列、插線盤的三顆動作鍵被擠到看不見。
  - **現在怎麼做**：只改 `creditRoll` 頁的 `widgetLayout` 與 `kpi()` 的字型參數；量表是 canvas 畫字、不吃 CSS 變數，所以 `typography()` 預設值維持 PayPal 字型。
  - **沒選的做法會怎樣**：不動版面，截圖 06 看不到兩張幽靈卡片的完整內容；改全域 `studioCanvasRowHeight` 會讓所有報表頁一起變高。
- **規格缺口**：brief 把 `initial-report.ts` 列為「保留公開介面與測試預期行為」，沒說可否調內部版面常數。
- **影響範圍**：匯出名稱、頁面 id、widget 類型與 17 條測試都不變；`reports-store.ts` 的「內建報表沒改過就讀程式碼」機制讓舊瀏覽器也會看到新版面。
- **判定**：`sound` — 公開介面與測試行為不變，版面與字型屬本次 UI 範圍。
- **把握度**：中

#### U6 — 整個 AG Studio 改深色（包括 Revenue、Receivables 等其他報表頁），PayPal 淺色 token 只留給 5 個端點頁
- **何時**：Pass 2（`app/dashboard/studio/theme.ts:25-59`、`app/globals.css:22`、`:75`）
- **決定**：
  - **標題**：新增 `--cr-*` token；AG Studio 主題設 `browserColorScheme: 'dark'`、畫布透明、底下是檯燈光漸層；`--pp-*` 原封不動。
  - **觸發事件**：brief 要求「暗房剪輯台」質感並重做主題外殼。
  - **現在怎麼做**：Dashboard 外殼、兩顆 widget、KPI、AG Grid、圖表配色都走 `--cr-*`；`(endpoints)` 五頁的 AG Grid 仍引用 `--pp-*`，維持 PayPal 白底。
  - **沒選的做法會怎樣**：直接改 `--pp-*` 色值，端點頁會一起變暗但沒驗證過；只讓兩顆 widget 變暗、外殼維持白色，暗色元件嵌在白卡片裡，質感斷裂。
- **規格缺口**：brief 沒說其他報表頁與端點頁要不要跟著改。
- **影響範圍**：所有報表頁的圖表序列色改成琥珀、青、PayPal 藍…；端點頁沒有重新設計。
- **判定**：`sound` — 兩套 token 並存，對端點頁零影響。
- **把握度**：中

#### U7 — 放映台的「Roll」只讓齒孔與影格計數器走動，名單本身不自動捲動
- **何時**：Pass 2（`app/dashboard/studio/credit-roll-widgets.tsx:165`、`:180`、`:319`；`app/globals.css:224`）
- **決定**：
  - **標題**：Pause／Resume Roll 現在有實際效果：兩側齒孔上移、時碼影格位數以 24fps 跳動；暫停即停。
  - **觸發事件**：原本切換 Roll 時畫面幾乎沒變（只差 `opacity-95`）。
  - **現在怎麼做**：名單列固定不動，點擊目標穩定；`prefers-reduced-motion` 時全部停止。
  - **沒選的做法會怎樣**：讓名單真的往上捲，可點的按鈕會一直移動，難點、難截圖，對輔助科技也不友善。
- **規格缺口**：spec 寫「Playable, rewindable cinema end-credits roll」，沒定義播放的視覺行為；「rewindable」本次與先前都沒做。
- **影響範圍**：README Key Features 的「Playable, rewindable」文案與實作仍有落差（既有文案，本次未改）。
- **判定**：`sound` — 動態感與可操作性兼顧。
- **把握度**：中

#### U8 — 清除篩選鍵移到放映台底部、取代「Active filter」讀數；cut 鍵與名單按鈕加 `aria-pressed`
- **何時**：Pass 2（`app/dashboard/studio/credit-roll-widgets.tsx:132`、`:143`、`:190`、`:200`、`:236`）
- **決定**：
  - **標題**：有篩選時底部顯示「Filter: crew-moth ×」按鈕（`data-testid="clear-cross-filter"` 不變），沒篩選時顯示「all crew · 5 cues」（原本寫死「ALL CREW (6)」）。
  - **觸發事件**：widget 只有約 452px 寬，篩選晶片放在控制列會換行、吃掉名單約 36px 高度。
  - **現在怎麼做**：控制列只剩 v1／v2／Pause Roll 一排；切換鍵用 `aria-pressed` 表達目前選中的 cut 與聯動中的人。
  - **沒選的做法會怎樣**：留在控制列，截圖 06 只看得到 2.5 張卡片。
- **規格缺口**：brief 只要求保留 testid，沒規定位置。
- **影響範圍**：依 testid 操作的腳本不受影響；依座標或 DOM 順序錄的腳本（例如重錄 onetake 影片）要更新。
- **判定**：`sound` — 契約不變、版面更省。
- **把握度**：高

#### U9 — 首頁文案先對程式核實，兩句改寫成實際行為
- **何時**：Pass 2（`app/page.tsx:487`、`:673`）
- **決定**：
  - **標題**：「nothing moves until a producer flips the approval switch」改為「crew payouts stay locked until…」；「computed live」改為「comes from the same reconciler」。
  - **觸發事件**：寫帳本時逐句核對，發現核准開關只鎖批次撥款（`app/dashboard/studio/credit-roll-widget-state.ts:228`），訂單與發票不需核准；首頁在 build 輸出是靜態預渲染（`○ /`）。
  - **現在怎麼做**：對外文案只寫程式保證得了的行為；冪等重送的說法有 `lib/credit-roll-settlement.ts:656-661` 的 `idempotentReplay` 佐證。
  - **沒選的做法會怎樣**：保留原句，對外誇大了核准範圍與即時性。
- **規格缺口**：brief 沒提供首頁文案。
- **影響範圍**：首頁對外說法；之後新增文案應照同樣方式核實。
- **判定**：`sound` — 對外宣稱必須與程式一致。
- **把握度**：高

#### U10 — 頂部列 persona 與導覽、網站 metadata 改為 CreditRoll Live
- **何時**：Pass 2（`app/dashboard/components/app-shell.tsx:41`、`:53`；`app/layout.tsx:35`）
- **決定**：
  - **標題**：「Demo merchant／AG」改為「Executive producer／EP」；字標與「← Dossier」連回首頁；分頁標題改「CreditRoll Live — …」，子頁「%s · CreditRoll Live」。
  - **觸發事件**：原本只有首頁→Dashboard 的單向連結，分頁標題仍是 starter 模板的「PayPal × AG Grid」。
  - **現在怎麼做**：首頁與 Dashboard 雙向可達；AG Studio 標誌改用 `currentColor` 以便在深色頂部列顯示。
  - **沒選的做法會怎樣**：保留 PayPal 開發者後台的「Demo merchant」字樣，與片場敘事不搭；分享連結時標題仍是模板名。
- **規格缺口**：brief 沒規定 persona 文字與 metadata。
- **影響範圍**：瀏覽器分頁標題、社群分享預覽。
- **判定**：`sound` — 屬品牌一致性的低風險調整。
- **把握度**：中

#### U11 — 截圖 07（三個 PayPal 動作觸發後的回讀收據與 QR）先不拍，不用假資料代替
- **何時**：Pass 2（session 實測；證據 `/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/.scratch/credit-roll-live/dispatch-opus-ui/receipts/patchbay-no-credentials-error.png`）
- **決定**：
  - **標題**：README 畫廊先放 05、06，07 等使用者決定資料來源。
  - **觸發事件**：worktree 與主 checkout 都沒有 `.env.local`，shell 環境也沒有 `PAYPAL_*` 變數；實點 BTS Order 時 `POST /api/credit-roll/supporter-order` 回 502，橫幅為「PAYPAL_CLIENT_ID and PAYPAL_SECRET must be set (see .env.local)」。目前程式碼也沒有無憑證時的本地預覽收據。
  - **現在怎麼做**：不攔截 API、不造假收據；只把無憑證時的錯誤畫面存成驗收證據。
  - **沒選的做法會怎樣**：用 Playwright 攔截 `/api/credit-roll/*` 回 fixture 拍照，對外 README 會展示不是真實 Sandbox 回傳的收據。
- **規格缺口**：brief 要求 07 顯示回讀收據，但沒說明沒有憑證時的做法。
- **影響範圍**：README 畫廊與對外展示。
- **判定**：`needs-user` — 暫定做法：先交 05、06，07 留空。撤回方式：使用者把 Sandbox 憑證寫進 worktree 的 `.env.local` 後重拍真實版；或明確同意以 fixture 重播拍攝並在 README 圖說註明。
- **把握度**：低

#### U12 — 新增三套 Google 字型（Bodoni Moda 含 opsz 軸、Archivo 含 wdth 軸、Courier Prime），經 `next/font` 自架
- **何時**：Pass 2（`app/layout.tsx:2-30`）
- **決定**：
  - **標題**：Bodoni Moda 負責標題與片尾名字、Archivo 負責介面（寬度軸做出片尾職稱的窄體大寫）、Courier Prime 負責 cue sheet 打字紙、Geist Mono 留給雜湊與時碼。
  - **觸發事件**：brief 要求字體層次與博物館、獨立電影工業質感。
  - **現在怎麼做**：`package.json` 零變動；字型在 build 時下載並自架，瀏覽器不連 Google。
  - **沒選的做法會怎樣**：只用系統字型做不出層次；Instrument Serif 這類近年流行字型辨識度低。
- **規格缺口**：brief 沒指定字型。
- **影響範圍**：`next build` 需要能連 Google Fonts（既有 Geist Mono 本來就如此）；每頁多載約 4 個 woff2 檔。
- **判定**：`sound` — 無 npm 新相依，自架不洩漏使用者請求。
- **把握度**：高

#### U13 — 材質類別（膠帶、齒孔、印章、紙張…）集中在 `globals.css` 的 `@layer components`，配色靠 `data-status`／`data-cut` 屬性切換
- **何時**：Pass 2（`app/globals.css:147-640`）
- **決定**：
  - **標題**：新設計的視覺材質全部是 `cr-*` 全域 class；狀態印章與 v1／v2 主色用 data 屬性選擇器決定。
  - **觸發事件**：`tests/ticket-03-ag-studio-widgets.test.ts:23-81` 在 Node 裡直接載入 widget 的 `.tsx`，只處理 `.ts/.tsx`；widget 若 import CSS 檔，測試會載入失敗。
  - **現在怎麼做**：widget 只用 class 名稱與 data 屬性，不 import 任何樣式檔。
  - **沒選的做法會怎樣**：改用 CSS Modules，17 條測試裡的 ticket-03 會直接壞掉。
- **規格缺口**：brief 沒規定樣式組織方式。
- **影響範圍**：之後新增的 widget 樣式都會照這個模式寫在 `globals.css`。
- **判定**：`sound` — 唯一同時滿足測試載入方式與共用材質的做法。
- **把握度**：高

#### U14 — 首頁靜態預渲染，資料在 build 時算好
- **何時**：Pass 2（build 輸出 `○ /`，收據 `/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/.scratch/credit-roll-live/dispatch-opus-ui/receipts/build.txt`）
- **決定**：
  - **標題**：首頁不呼叫 PayPal、不需要憑證就能開。
  - **觸發事件**：`buildDossier()` 是純函式，只讀程式碼內的劇本資料。
  - **現在怎麼做**：Next 自動把 `/` 預渲染成靜態頁。
  - **沒選的做法會怎樣**：每次請求重算，沒有任何資料會因此變新，只是多花伺服器時間。
- **規格缺口**：brief 沒規定首頁的渲染方式。
- **影響範圍**：改種子資料後需要重新 build 首頁才會更新（本來部署就會 build）。
- **判定**：`sound` — 資料來源本身就是靜態的。
- **把握度**：高

#### U15 — 常駐 CSS 動畫（顆粒、齒孔、影格計數、首頁片尾滾動、跑馬燈、燈光閃爍），`prefers-reduced-motion` 時全停
- **何時**：Pass 2（`app/globals.css:181`、`:224`、`:627`）
- **決定**：
  - **標題**：Pause Roll 只停齒孔與計數器，底片顆粒持續跳動。
  - **觸發事件**：brief 要求暗房膠卷的臨場感。
  - **現在怎麼做**：動畫都只動 `transform`、`opacity` 或註冊過的整數自訂屬性，不在 JS 裡逐格重繪。
  - **沒選的做法會怎樣**：用 JS 計時器逐格更新時碼，會讓 React 每秒重繪 24 次。
- **規格缺口**：brief 沒規定動畫範圍與效能預算。
- **影響範圍**：Dashboard 開著時持續有合成層動畫；低階機器上若卡頓，可先拿掉 `.cr-grain` 的動畫。
- **判定**：`sound` — 成本落在合成層，且尊重減少動態偏好。
- **把握度**：中

### 本段尾註

「範圍解讀」一類扎堆 5 條（U5、U6、U7、U10、U11）：派工 brief 對「哪些畫面在重製範圍內」與「截圖 07 的資料來源」有霧。建議下一次派 UI 工作時，在 brief 先列清楚要重製的路由清單、可否動 `initial-report.ts` 版面，以及沒有 Sandbox 憑證時截圖要怎麼處理。
