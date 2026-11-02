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
