# Worker brief：credit-roll-live-onetake-film / paypal-credit-roll-live

你是 `/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/.claude/worktrees/opus-onetake-film` 裡的完整 Claude Code session（模型：`opus[1m]`，effort：`max`），這個 repo 與全域 `~/.claude` 的 hook、skill 與 settings 對你生效。派工的是另一個 session（main），它不在這個 worktree 裡；使用者本人也可能直接在這個視窗打字。

## 任務

使用全域 `onetake` skill（`/Users/linhancheng/.claude/skills/onetake/SKILL.md`），為 **PayPal AI Hackathon 2026** 參賽作品 **CreditRoll Live** 重新設計並渲染一支高美感、電影感十足的 45 秒產品演示短片（Concept a · 消失的名字 Ghost in the Roll），工作目錄放在 `/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live-opus/`，最終成品輸出並覆寫至 `/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/dist/credit-roll-live-demo.mp4`。

## 互動規則

- 使用者已經拍板選定「概念 a · 消失的名字（Ghost in the Roll）」，不需要再問使用者選哪個概念；直接動手把視覺美感、構圖留白、字體排印、運鏡節奏做到極致並完成渲染與驗證。若遇到只有使用者能決定的重大範圍分歧，才把問題原文印出來、停下等答案。
- 以 `[main]` 開頭的訊息是 main 轉達的；其中標「以下為使用者原話」的段落才是使用者裁決，其餘是 main 的判讀。沒有前綴的訊息是使用者本人打的。
- 要宣稱「使用者已同意 X」之前，先在對話裡找到人打的那一句；找不到就把 X 列成待拍板。
- 任務全部做完並通過視覺自檢與 `verify_promo.py` 後再回報一次。回報要含：
  1. 新舊設計的美感差異與你做的關鍵視覺決策（配色、留白比例、字體層級、運鏡 Carry 銜接）
  2. `stills.png` 逐格視覺檢查結果與檔案路徑
  3. `verify_promo.py` 完整 8 項指標輸出
  4. 最終影片 `/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/dist/credit-roll-live-demo.mp4` 的 `ffprobe` / `ls -lh` 實測數據
  5. 沒做的部分（若無則明寫無）

## 邊界

- 不 push、不開 PR、不 rebase、不 amend。
- **嚴禁跑 `pkill -f chrom`、`killall Google Chrome` 等廣域殺程序指令**（會殺死使用者正在使用的日常 Chrome 與 LCU 連線）；只准清自己啟動的 PID。
- 手動截圖與驗證收據放 `/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/.scratch/credit-roll-live/dispatch-opus-film/receipts/`，影片原始檔與合成資產放 `/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live-opus/`。
- 執行 `onetake` Python 腳本時使用：
  `uv run --with playwright --with numpy --with pillow --with scipy --with fonttools --with brotli --with matplotlib python3`

## 脈絡

- 規格與產品說明：
  - `/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/.scratch/credit-roll-live/spec.md`
  - `/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live/BRIEF.md`
  - 實機產品截圖（供對照真實資料與 UI 元素）：`/Users/linhancheng/Desktop/projects/paypal-credit-roll-live/dist/screenshots/01-hero-dashboard.png` 至 `05-crew-settlement-paid.png`
  - 本機正在跑的實機伺服器：`http://localhost:3199/dashboard`（已啟動，可隨時參考，請勿關閉）
- 以下為使用者原話（逐字）：
  - `a吧`（選定概念 a · 消失的名字 Ghost in the Roll）
  - `你可以讓opus5.5來做影片嗎？你的美感真的不行，用herdr worker派opus5.5 max試試看`
- main 的判讀（不是裁決）：
  1. **為什麼前一版（`/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live/stills.png` 與 `comp.html`）美感不及格**：
     - 先用 `Read` 看一眼舊版 `/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live/stills.png` 當反面教材：舊版違反了 `onetake` 的核心美學（「Small elements, big ground — The genre's frame is 70% ground」、精緻字體排印、焦點單純），把整張畫面塞滿死板的深色後台外框、密密麻麻的小字標籤與擁擠的雙欄面板，看起來像廉價的工程師壓字簡報，完全沒有「電影片尾滾動字幕 × 精準焦點縮放」的戲劇張力與高級設計感。
  2. **動手前必讀 `onetake` 範本與參考案例**：
     - 先讀 `/Users/linhancheng/.claude/skills/onetake/SKILL.md`、`/Users/linhancheng/.claude/skills/onetake/references/product-demo.md`、`/Users/linhancheng/.claude/skills/onetake/references/composition.md`、`/Users/linhancheng/.claude/skills/onetake/references/rhythm.md`。
     - 去看 `/Users/linhancheng/.claude/skills/onetake/gallery/sheets/looks.png` 以及 `/Users/linhancheng/.claude/skills/onetake/cases/one-dot-15s/comp.html`、`clearing-15s/comp.html`、`pith-21s/comp.html` 是怎麼做「大留白、極簡精準的 UI 局部聚焦（focused component cards rather than cluttered full-page dumps）、有重量的彈簧物理、電影級字體排印（display serif/sans + tabular mono）、以及流暢的 `OM.camera` 追蹤運鏡」。
  3. **建議執行步驟**：
     - 可直接複用 `/Users/linhancheng/Desktop/projects/onetake-trial/films/credit-roll-live/vo/` 裡已生成的 6 段英文語音（或重新調整混音 `sfx_score.py`），確保旁白與雙語字幕清晰優雅、絕不遮擋主視覺。
     - 先用 `stills.py` 輸出關鍵影格拼圖（contact sheet），**必須親自用 `Read` 檢視圖片**，挑剔檢查每一格的字距、留白、色彩對比、游標位置與轉場延續性（Carry），修到美感真正像 Apple / Stripe / 高質感獨立電影預告片的水準後，再跑 `render.py` 渲染 1080p30 成片並通過 `verify_promo.py` 全部檢查。
