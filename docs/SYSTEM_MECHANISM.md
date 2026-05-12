# AiHunter 系統機制說明

## 一、方案與功能限制

### 方案等級

| 方案 | 月費 | AI 深度分析 | 履歷解析/分析（含 CV 編寫） | 產業刷新 | 廣告解鎖 | 針對性履歷 + 針對性 CV | 履歷版控 |
|------|------|------------|---------------------------|---------|---------|---------------------|---------|
| **Free** | 免費 | 3 次/月 | 3 次/月（履歷+CV 共用）| 需解析券（Top 20）| ✅ | ❌ | ❌ |
| **Pro** | NT$300 / 月 | 30 次/月 | 15 次/月（履歷+CV 共用）| 無限（Top 20）| ❌ | ❌ | ❌ |
| **Max** | NT$800 / 月 | 無限 | 無限 | 無限（Top 20）| ❌ | ✅ 無限 | ✅ |

> **定價策略（2026-05-09 拍板）**：先打台灣市場，TWD 定價。Pro NT$300 對標 Notion Plus；Max NT$800 跳出 ChatGPT Plus（NT$640）的「通用 AI」比較區，定位「專業 SaaS 工具」。Pro→Max 跳幅 2.67x，SaaS 經典甜蜜點。未來全球化後可加 USD 對應價（$9.9 / $29.9）。

> **Super User**（`User.isSuperUser=true` 資料庫欄位）：跳過所有限制，無限使用所有功能。設定方式為直接在 DB 改 `User.isSuperUser=true`，不再使用環境變數或硬編碼 email。

> **Max 旗艦獨享**：針對性履歷、針對性 CV、履歷版控（左側「履歷版本」資料夾）為 Max 專屬功能，Free / Pro 看不到入口。

---

## 二、解析券（Ticket）系統

### 概念

解析券是 Free 方案用戶突破月度限制的補充額度，透過觀看廣告獲得，各功能消耗數量不同。

### 票券定價

| 功能 | 消耗解析券 |
|------|-----------|
| 職缺 AI 深度分析（Insight）| 1 張 |
| 履歷解析（Resume Parse）| 1 張 |
| 履歷 AI 分析（Resume Analyze）| 1 張 |
| 一般 CV 編寫 / AI 起草 / AI 建議 | 1 張（與履歷解析/分析共用 `analysis` 配額） |
| 產業 Top 20 強制刷新 | 3 張 |

> 針對性履歷、針對性 CV 為 Max 旗艦專屬，**不透過解析券或月度配額提供**，Free / Pro 完全無此功能。

### 票券特性

- **持久化**：解析券不隨月份重置，跨月累積使用
- **通用**：可用於上述任一功能（除產業刷新需 3 張外）
- **上限**：每月廣告解鎖上限 5 次，最多獲得 5 張券
- **Pro/Max 不適用**：付費方案不顯示廣告，也不使用票券系統

---

## 三、廣告解鎖機制

### 觸發條件

Free 方案用戶的某功能本月免費次數用完，且票券不足時，UI 顯示「看廣告獲得解析券」按鈕。

### 廣告觀看流程

```
用戶點擊「看廣告」
    ↓
顯示廣告 1/3（30 秒倒數）
    ↓
顯示廣告 2/3（30 秒倒數）
    ↓
顯示廣告 3/3（30 秒倒數）
    ↓
POST /api/ads/unlock（驗證）
    ↓
成功 → adTickets +1，adUnlocksUsed +1
    ↓
前端自動重試原始功能
```

### 月度廣告次數上限

- 每月最多觀看 **5 次廣告**（每次 3 則，共 90 秒）
- 達到上限後顯示「本月廣告解鎖已達上限」，引導升級
- `adUnlocksUsed` 欄位記錄本月已使用次數，隨 `usageMonth` 重置

### 廣告收益估算（每次 3 則 × 30 秒）

| 地區 | 每次收益 | AI 成本（Insight）| 覆蓋率 |
|------|---------|-----------------|-------|
| 台灣 | ~$0.009–0.024 | ~$0.020 | 45–120% |
| 美日 | ~$0.045–0.120 | ~$0.020 | 225–600% |

> 產業刷新需 3 張券（等同 3 次廣告觀看）→ 台灣覆蓋率約 90%，美日大幅獲利。

---

## 四、計費流程（每次 AI 功能執行）

```
用戶觸發 AI 功能
    ↓
consumeUsage(userId, action) — lib/billing.ts
    ↓
是否為 Owner？ → 是 → 直接通過（不記錄）
    ↓ 否
是否 Max/Pro（limit=null）？ → 是 → 通過，記錄使用量
    ↓ 否
本月免費次數未用完（used < limit）？ → 是 → 通過，used+1
    ↓ 否
解析券 ≥ ticketCost？ → 是 → 扣券，used+1，通過
    ↓ 否
回傳 402 LIMIT_REACHED（含 planTier、tickets、adSessionsLeft）
    ↓
前端顯示廣告解鎖按鈕 / 升級按鈕
```

---

## 五、月度重置機制

- `usageMonth` 欄位格式：`"2026-05"`
- 每次執行功能時比對 `usageMonth !== currentMonth()`
- 若不同（新的月份）：**惰性重置** — 僅重置當前功能的計數器，並更新 `usageMonth`
- `adTickets`（解析券餘額）**不重置**，跨月累積
- `adUnlocksUsed`（本月廣告次數）隨 `usageMonth` 重置

---

## 六、訂閱付費（Stripe）

### 升級流程

**新訂閱（Free → Pro / Max）**：
1. 用戶點擊「升級方案」→ POST /api/stripe/checkout
2. 建立或取用既有 Stripe Customer（以 `stripeCustomerId` 關聯）
3. 建立 Checkout Session（subscription 模式），metadata 帶入 `userId + tier`
4. 跳轉 Stripe 付款頁
5. 付款完成 → Webhook `checkout.session.completed` → 更新 `planTier`

**Pro → Max 立即升級（按比例補差價）**：
- POST `/api/stripe/upgrade-now` 用 `stripe.subscriptions.update` 把現有 subscription 的 item 改成 Max price
- 使用 `proration_behavior: "always_invoice"` → Stripe 計算本期剩餘的差價、開立並立即收款
- DB 端立即 `planTier = "max"`、清除任何 pending downgrade schedule
- 下個 billing cycle 自動以 Max 全價續扣
- 觸發場景：Top 20 modal 中 Pro 用戶本月配額用完後在 `pro_quota_exceeded` prompt 點「立即升級 Max」

### Webhook 事件處理

| 事件 | 動作 |
|------|------|
| `checkout.session.completed` | 更新 planTier = tier（從 subscription metadata 取得）|
| `customer.subscription.updated` | 依 status 更新 planTier（active → tier；其他 → free）|
| `customer.subscription.deleted` | planTier = "free"，清除 stripeSubscriptionId |

### 所需環境變數

```env
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_MAX_PRICE_ID=price_...
```

### 產業 Top 20 進入頁 UX（first-fetch-free + sticky last-viewed）

進入 `/industry`：

| 場景 | 行為 |
|------|------|
| 使用者**從沒選過任何類別**（`User.lastViewedIndustry === null`）| 不預設選中任何 chip，下方空白，等使用者點 chip |
| 使用者**之前選過**（`lastViewedIndustry === X`）| 自動套用 X、`GET /api/industries?industry=X` → 顯示 cache |
| 點 chip 切換類別 | `setSelectedIndustry` + `PATCH /api/user/profile { lastViewedIndustry }` → SWR 重發 GET |

**GET `/api/industries?industry=X` 的後端決策**：
- IndustryCache 該類別 row 存在 → 直接回（含 stale flag）。
- IndustryCache 該類別 row **不存在** → **後端即時生成**（Claude + Adzuna probe + 寫 cache + 回），**不過 gate、不扣任何使用者**。一旦寫入後，後續任何閱覽都讀 cache，不會再 auto-gen。

**「🔄 重新獲取」按鈕**：只在有資料時可見，走 POST 風格的 `?refresh=1`，必過 `consumeUsage("industryRefresh")` gate：
- Free：3 張解析券（不夠 → 看廣告獲取）
- Pro / Max / SuperUser：通過 gate 但 `industryRefreshPerMonth=null`（無限）→ 直接執行

**為何安全（first-fetch-free 不會被 abuse）**：
- 一個類別只在 IndustryCache 該 row **完全不存在**時 auto-gen，寫入後就佔據該 row 永久。
- 重整頁面、切類別來回、不同使用者輪流訪問都讀同一個 cache row，不會重複觸發 auto-gen。
- 想要更新資料只能走付費的 `?refresh=1`。
- Free 用戶最多能在「系統還沒有任何使用者建立過該類別 cache」時觸發一次免費生成（系統等級的 one-shot per 類別）。

---

### Top 20 各公司職缺清單（**新機制**）

**入口**：產業頁每間公司有「工作機會 (N)」徽章，N 是該公司在 Adzuna 的職缺總數。點擊 → 開啟 **Fancybox 風格 modal**。

**資料來源**：Adzuna API（按公司名查），多國家並行 probe（依 AI 給的 `region` tag 動態決定）。Adzuna 沒覆蓋的國家（JP/KR/HK/CN）會顯示 0。

**取得 jobCount 的時機**：只在「強制更新」產業頁時 probe，存進 IndustryCache（7 天），平常瀏覽 0 額外 API 呼叫。

**公司名規範化（canonicalCompanyName）**：AI 偶爾回傳複合名（如 `Google/Alphabet`、`Meta (Facebook)`）。Adzuna 與 Job 表都以單一品牌名為 key，所以所有對 Adzuna 與 DB 的查詢都會先取主要段（`/` 或 `()` 前的非空首段）。例：
- 顯示給使用者 / cache name：`Google/Alphabet`（保留 AI 原文）
- Adzuna 查詢 / Job.company 比對 key：`Google`
- 強化方案：AI prompt 已禁止複合名，但既有 cache 仍可能含舊資料，所以 modal 端永遠 canonicalize。
- 修補式總數：`total = max(cacheCount, dbCount)`，避免舊 cache 的小數字蓋掉新查到的大數字。

**Adzuna 錯誤恢復**：`adzunaCountOne` / `adzunaFetchCountry` 對 strict `company=` 查詢的**任何**錯誤（400/404/timeout/429/5xx）都會落到 `what_phrase=` fallback，不再因 status guard 提早回 0（修正 OpenAI 跨次刷新跳 0 的 bug）。

**what_phrase 的 post-filter（避免徽章/列表落差）**：strict `company=` 失敗時，落到 `what_phrase=` 但**只計入** `display_name` 真的對應該公司的 row。沒有這個 post-filter，OpenAI 等 Adzuna 未索引的雇主會回 8979 筆「JD 提到 OpenAI」的職缺、但 modal 抓回的 `display_name` 都不是 OpenAI、DB 過濾後 0 列 → 徽章和清單對不上。現在 badge count 跟 modal 列表都用同一份 post-filter 結果（限制：fallback 取樣 50 筆，少數情況會略低估）。

**Modal 內容**：分頁顯示（10 筆/頁），每筆用 JobCard 樣式，與職缺流卡片視覺一致。

#### Per-user 評分（per-page 解鎖）

| Plan | 解鎖規則 |
|------|---------|
| **Free** | 每張解析券（廣告券通用）解鎖 1 頁（10 個職缺）|
| **Pro** | **每月每家公司前 2 頁免費**；超過 → 🔒 → 提示「升級 Max」或「等下月額度」（**不接受券支付**）|
| **Max** | 無限解鎖、無限重新計算 |

**鎖頭互動（per-row 點擊）**：
- Free：點鎖頭 → 跳 `unlock_confirm` prompt → 內部依券庫狀態分流：
  - 券數 ≥ `TICKET_COSTS.companyScoring` → 顯示「✅ 使用 N 張解析券解鎖」（按 = 扣券解鎖）
  - 券數不足 + 本月廣告觀看次數 > 0 → 顯示「📺 看廣告 +1 解析券（本月剩 X 次）」→ 觀畢券庫 +1、prompt 自動 refetch policy → 按鈕翻回「使用 N 張解析券解鎖」**讓使用者再次主動點才扣券解鎖**（券到手與動用是兩步動作，UI 上不自動 retry）
  - 券不足且廣告也用完 → 顯示「🚀 升級方案」
- Pro 超出月配額（本月此公司 ≥ 2 頁）：點鎖頭 → 跳 `pro_quota_exceeded` prompt → 「等下月配額重置」或「升級 Max」（Max 變更生效時點請見計費段落）
- Max / SuperUser：理論上不會有鎖頭（auto-score 涵蓋全部）；若因 race 出現，鎖頭點擊降回普通 unlock 流程
- 任一 plan 但履歷沒解析（`policy.needsResume`）：顯示頂部 banner 提示前往「履歷」頁；鎖頭點擊不開 prompt（沒有任何分數能算）

**「重新計算」按鈕**（僅 Pro/Max 顯示，且本頁所有 row 都有分數時才出現 — 空頁不顯示）：
- 條件：當前 `Resume.parsedHash` ≠ 已評分的 `JobScore.parsedHash`
- 若履歷沒新版本 → toast：「請先到「履歷」頁上傳新版」
- 重算成本同初次解鎖（消耗 Pro 月度配額或 Max 免費）

**分數永久保留**：一旦評分成功，存進 `JobScore` 表，下次打開同公司同職缺**直接讀取**、零成本（除非履歷有新版本）。

#### 跟職缺流的雙向獨立

| 維度 | 職缺流 `/feed` | Top 20 Modal |
|------|---------------|--------------|
| 分數欄位 | `Job.score`（generic、隨職缺流評分時機更新）| `JobScore[userId][jobId]`（per-user、按解鎖時機）|
| 評分時機 | 使用者首次進職缺流 / 手動點「更新職缺」| 使用者按「解鎖此頁分數」按鈕 |
| 評分動作影響 | 寫 Job.score | 寫 JobScore，**不影響** Job.score |

**收藏連動**：兩邊都用 `JobCard` + `/api/saved`，同一個 jobId 在三處（職缺流、Modal、/saved）**自動雙向同步**。

---

### 計費執行守則（不可被重整頁面繞過）

所有 AI 操作必須走 `consumeUsage` 或對應的 plan 門控（`ensureMaxOrSuper`、`ensureCoCreateAccess`、`consumeCompanyScoring`）才可執行。**任何 endpoint 只要會打 Claude / Adzuna AI 推理，就必須先過 gate**。

| Endpoint | 何時收費 | 行動 / Plan 限制 |
|----------|---------|----------------|
| POST `/api/industries?refresh=1` | 顯式 `refresh=1` | `industryRefresh`（3 張券；Pro/Max 免費） |
| GET `/api/industries`（無 refresh） | 永遠不收費 | IndustryCache 有 row → 讀 cache；無 row → **後端 auto-gen 一次（first-fetch-free，所有 plan 都不扣）**並寫 row。寫入後永久不再 auto-gen，更新要走 `?refresh=1`。|
| POST `/api/jobs/[id]/insights` | 每次呼叫 | `insight`（Free 3、Pro 30、Max ∞）；GET 永遠免費讀 |
| POST `/api/resume/parse` | 每次成功上傳 | `analysis`；先驗證 rawText 有內容才扣 |
| POST `/api/resume/analyze` | 內容 hash 不同才收費 | `analysis`；同 hash → 直接回 cache，不收 |
| POST `/api/cover-letter/draft` | 每次 AI 起草 | `analysis`；先驗證 user 有履歷才扣 |
| POST `/api/crawl` | **每次更新職缺**（除了首次 onboarding） | `analysis`；Job 表為空時免費（onboarding 首抓） |
| POST `/api/jobs/[id]/cv` (B 履歷) | Max only | `ensureMaxOrSuper` 403 擋住非 Max |
| POST `/api/jobs/[id]/cover-letter` (B CV) | Max only | 同上 |
| POST `/api/chat/threads/*/message` | Max only | `ensureCoCreateAccess` 403 |
| GET `/api/companies/[name]/jobs` | Max/Pro 自動評分；Free 不評分 | `consumeCompanyScoring`（Free 1 張券/頁；Pro 月度 2/公司；Max ∞） |
| POST `/api/companies/[name]/jobs` | 明確 unlock / recalculate | 同上 |

**已驗證沒有 bypass 的設計：**
- 重整頁面不會重跑 AI（讀 cache）
- 第一次入口的 onboarding 例外都有條件（履歷必填、Job 表為空等）
- 「免費先扣再做」的順序錯誤已修（先驗證輸入再 `consumeUsage`）

---

### 公司最近一季財報（產業 Top 20）

展開公司行後顯示：
- **期別**（Q3'25 等）+ 截止日 + 獲利/虧損 tag
- **營收**：金額 + YoY % + QoQ %
- **淨利**：金額（依正負染色）+ YoY % + QoQ %
- **資料來源**：Yahoo Finance（非官方 endpoint），24h DB 快取
- **私人公司**（無 ticker）：顯示「未公開財報」

> Yahoo 為非官方 API，若失效需切換供應商（Alpha Vantage / Finnhub）。

---

### 薪資查詢（Phase 1 + Phase 2）

左側 sidebar 「薪資查詢」（💰），全 plan 免費、不過 billing gate、不打 AI。

**架構（driver 層）**：`lib/salary-sources/` 抽掉資料源細節 — `twinkle.ts`（TW gov）與 `adzuna-aggregate.ts`（海外）各自實作；`/api/salary` route 根據 `country` 參數 dispatch。

#### Phase 1 — TW 政府公開資料

**資料來源**：[Twinkle Hub](https://hub.twinkleai.tw/)（MCP / JSON-RPC 2.0）→ 勞動部「受僱員工人數、每人薪資-XX業（按職類別分）」資料集（41685–41700 共 17 個產業 dataset）。每年 7 月更新。

**對照**：我們的 37 個內部產業 → 政府 17 個行業大類的 mapping 在 `lib/salary-sources/industry-mapping.ts`。少數產業（agriculture / government）對應到 null，UI 顯示「Phase 2 才會接 Adzuna 海外資料」placeholder。

**運作流程**：
1. 使用者在 `/salary` 選國家 = TW + 一個產業 chip
2. `/api/salary?country=TW&industry=X` 經 `SalaryCache`（7 天 TTL）→ 沒命中再打 Twinkle 的 `opendata-query_rows`
3. Twinkle 回傳當年度全部 rows（依「行業別」分 sub-industry）
4. Driver 以「職類別」聚合、員工數加權平均成 1 列 / 1 職類
5. 回 `summary`（產業整體加權平均月薪 / 年薪 / 樣本總數）+ `rows`（各職類）

#### Phase 2 — 海外 Adzuna 彙整

**資料來源**：我們自己的 Job 表中 `source="adzuna"` 的列（由 Top 20 + job-feed pipeline 寫入）。換句話說：**不再額外打 Adzuna**，純粹彙整既有資料。

**驅動方式**：`/api/salary?country=US&industry=X&companyType=Y&experience=Z` →
1. `buildJobWhere`：`source:"adzuna"` + `country IN COUNTRY_TO_ADZUNA[country]` + `salary>0` + 可選 `companyType`（先查 `CompanyClassification` 撈公司名集合，再 OR `company contains`）+ 可選 `experience`（用 `Job.yearsMin/yearsMax` overlap 算）。
2. `prisma.job.findMany`（最多 5000 筆 salary 欄）。
3. 每列取 (min, max) midpoint，按 `FX_TO_TWD` 換 TWD/年；剔 <100k 或 >30M 的離群（多半是 Adzuna 單位混淆）。
4. sort → 算 P25 / P50 / P75 / mean。
5. 回 `summary` + per-mode `source.note`（誠實標註：是雇主開價、不是員工實得；年資為職缺要求年資，非實際工作年資）。

**支援的國家**：

| 國家 | mode | 備註 |
|---|---|---|
| TW | tw_gov | Phase 1 路徑（政府資料） |
| US | adzuna | Adzuna US 國家標籤；樣本足夠 |
| UK | adzuna | Adzuna GB 國家標籤 |
| AU | adzuna | Adzuna AU 國家標籤 |
| EU | adzuna | 合成 DE/FR/NL/ES/IT/PL；Adzuna 歐洲 per-country 不均 |
| JP / KR / CN | disabled | UI chip 灰，點選後顯示「資料尚未開放」卡 |

**JP/KR/CN 的真實狀況**（不是「完全沒資料」）：Adzuna **per-country** 端點對日韓中近乎零，所以我們的 Job 表用 `country=JP` 撈不到東西。但 Top 20 + job-feed 從 US/UK/EU 抓的職缺中，**確實有亞洲總部公司的海外職位**（如 MediaTek 美國 office、Sony US 職位）— 這些已被算進其對應的駐在國（US/UK/EU）薪資池，不是「JP 在地薪資」。

**前端互動 vs 不閃**：UI 把 `userMonthly` / `userAnnual` 完全留在前端，self-eval 用 `useMemo` 即時算。SWR fetch key 只跟 (country, industry, occupation, companyType, experience) 走 → 打數字不會觸發 refetch，不會閃。

**6 個 CompanyType bucket**：

| key | 中文 | 範例 |
|---|---|---|
| `foreign_tier1` | Tier-1 外商 | FAANG、NVIDIA、ASML、OpenAI、Anthropic |
| `foreign_traditional` | 傳統外商 | IBM / Oracle / SAP / Big-4 / CPG |
| `tw_local` | 台商 | TSMC、Foxconn、MTK、Acer、Appier、iKala |
| `large_enterprise` | 大企業（其他） | Yahoo, Stripe-tier 非 Tier-1 大廠 |
| `sme` | 中小企業 | Notion / Figma / Linear / Vercel |
| `startup` | 新創 | Cohere / Perplexity / Cursor / Scale AI |

**Seed**：[scripts/seed-company-classifications.mjs](../scripts/seed-company-classifications.mjs) 一次 upsert **209 間**（初版；隨 Adzuna 看到的雇主擴張）。同一公司多筆別名容許（`Google` + `Alphabet`），用 `companyName` 唯一鍵 upsert。

**5 段年資 bucket**：`exp_0`（應屆）/ `exp_1_3` / `exp_3_7` / `exp_7_10` / `exp_10p`，比對 `Job.yearsMin/yearsMax` 與 bucket 區間是否有 overlap。

**FX 換算**：`FX_TO_TWD` 寫死於 [adzuna-aggregate.ts](../lib/salary-sources/adzuna-aggregate.ts)；USD=32 / GBP=40.5 / EUR=35 / AUD=21 / JPY=0.21 等。匯率漂移 >10% 時手動更新。

**自評百分位估計**：從前端拿 P25/P50/P75 三點線性插值，外推時 cap 在 100。這是粗估，UI 標「約 PXX」非精確值。

#### Phase 1 vs Phase 2 範圍對照

| 維度 | Phase 1 (TW gov) | Phase 2 (Adzuna) | 待補（Phase 3）|
|---|---|---|---|
| 產業 × 職類別 | ✅ | ⚠️ 無職類欄（Adzuna title 自由文字） | AI 分類職缺 title |
| 平均 / 中位數 | 僅平均 | P25/P50/P75 + mean | — |
| 國家 | TW only | US/UK/AU/EU；JP/KR/CN 灰 | 接 LinkedIn / 在地求職平台 |
| 企業類型（6 類）| 政府無此欄 | ✅（透過 CompanyClassification） | — |
| 年資 | 政府無此欄 | ✅（職缺要求年資 proxy） | 履歷實際年資 |
| 證照 / 作品 / 學歷 | — | — | 由 AI 解析履歷推估 |

**計費**：無。Twinkle 目前 alpha 免費；Adzuna 路徑只讀我們自己的 Job 表，零外呼。未來資料源收費時，driver 抽象在 `lib/salary-sources/` 可換源（接主計處 CSV 等）。

---

### AI 共創履歷（Max 旗艦專屬）

**入口**：右下角浮動 ✨ 按鈕，僅 Max 看得到。出現於 `/resume`、`/job/[id]` 等頁面。

**操作對象**：
- `/resume` → 一般履歷 / 一般 CV（使用者選）
- `/job/[id]` → 針對性履歷 / 針對性 CV（使用者選）

**互動模式**：
- 一般 chat 對話（zh-TW）+ AI 直接給「修改前 / 修改後」diff 卡片
- 使用者可一鍵套用，套用後自動寫入該文件並新增版本
- 對話歷史保存最近 30 場（同一份文件範圍內），超過自動刪最舊

**RWD**：
- 桌機（≥768px）：右側拉出 480px 寬面板
- 手機（<768px）：從下方滑上的全螢幕 sheet
- 提案卡內嵌在對話流中，無需分欄

**模型 / 成本**：
- Claude Haiku 4.5（chat + 提案產生共用）
- Max 月費 NT$900 真無限（重度使用 ~3000 訊息/月成本約 US$10）

**範圍限制**：
- AI 不發明資訊，只用現有文件 + 使用者輸入
- 提案的 `before` 必須是文件內存在的子字串
- 一次提案一處修改

---

### 取消 / 降級流程（期末生效）

| 動作 | 機制 | 時機 |
|------|------|------|
| **取消訂閱（Pro/Max → Free）** | `stripe.subscriptions.update({ cancel_at_period_end: true })` + 收集回饋寫入 `CancellationFeedback` | 當期結束時自動取消，UI 仍可用至期限 |
| **降級（Max → Pro）** | `stripe.subscriptionSchedules.create({ from_subscription })` 建立兩階段排程：phase1 Max 至期末 → phase2 Pro 1 個月 → end_behavior `release` 後續正常 Pro 訂閱 | 當期結束時自動切換 |
| **還原** | 取消的 `cancel_at_period_end=false`；降級的釋放 `subscriptionSchedules.release` | 立即生效 |

### 取消 / 降級的兩階段 UI 流程（PlanChangeModal）

點下「取消訂閱」或「降級為 Pro」後跳出 modal，採用**兩階段 loss-aversion 設計**：

1. **Impact warning（第一階段）**：明確列出取消/降級後**會失去什麼**、**會降級到什麼配額**、**會保留什麼**。內容依「動作種類 × 來源方案」分三套（cancel-pro / cancel-max / downgrade-max）。底部兩個按鈕：
   - 「**保留方案**」（主要按鈕、推薦的選項）→ 關閉 modal、保留訂閱
   - 「**繼續取消/降級**」→ 進入第二階段

2. **Feedback 收集（第二階段）**：跳出多選原因（7 個 enum）+ 自由文字。原因必填（取消）/ 選填（降級）。可點「← 返回」回到 Impact 警告。

> 設計依據：標準 SaaS 留客模式可降低 15-25% 的取消意願；同時搜集到的 churn 原因進 `CancellationFeedback` 表做產品優化。

### 金流串接

**現階段串接 ECPay 綠界**（台灣本地市場）：
- 訂閱：信用卡定期定額（需在綠界後台額外申請開通）
- 月費：Pro NT$300 / Max NT$800
- 抽成：信用卡 2.75% + NT$5/筆（一般廠商）或 2.85% + NT$5/筆（個人賣家）
- 撥款：T+7~30 工作天匯入綁定銀行帳戶

> Stripe 程式碼保留（routes 與 schema 欄位都還在），未來全球化時可重新啟用。

---

## 七、履歷與 CV 版本管理（Max 旗艦專屬）

### 設計動機

求職者針對特定公司會撰寫客製履歷與客製 cover letter，導致版本爆炸。系統提供版本夾集中保存所有歷史，作為 Max 旗艦級的進階吸引力。

### 文件矩陣

|  | A. 一般版 | B. 針對性版 |
|---|---|---|
| **履歷 (Resume)** | 全 plan，`/resume` 上傳/儲存 | **Max only**，職缺 Prepare 產出 |
| **CV (Cover Letter)** | 全 plan，`/resume` 手寫或 AI 起草 | **Max only**，職缺 Prepare 產出 |

> 履歷與 CV 是兩種獨立文件，性質不同（履歷是結構化工作經歷；CV 是自由敘事的求職信）。

### 命名規則

| 文件 | 命名 |
|---|---|
| A 履歷 | 使用者上傳原始檔名 |
| A CV | `<UserName>_cv.pdf`（系統命名） |
| B 履歷 | `Company_JobTitle_YYYY-MM-DD_Name_resume.pdf`（全英文） |
| B CV | `Company_JobTitle_YYYY-MM-DD_Name_cv.pdf`（全英文） |

> 公司或職稱遇中英混雜時由 AI 翻譯/音譯為英文。

### 架構不變式

1. **A 履歷是根**：所有 AI 分析（job feed scoring、insights、analyze）一律以 A 履歷為輸入；A 履歷一旦刪除整個系統的個人化基礎崩潰，故**禁止刪除**。
2. **A CV 不是分析輸入**：A CV 不參與任何 AI 分析或評分，只是版本夾收錄與編輯來源。
3. **B 文件是末端**：B 履歷與 B CV 產出後**不回流**任何分析或評分系統，純粹作為投遞素材。每個 (公司, 職缺) 僅一份各，重新產生即覆蓋。

### 版本與歷史

- **使用者視角**：每份文件只看到「最新版」
- **DB 視角**：所有覆蓋（A 重新儲存、B 重新產生）保留歷史快照（`isActive` / `isCurrent` 標記區分）
- 版本夾頁面**唯讀**：列表、預覽、下載；無刪除按鈕；要修改需回原源頭

### 下載

- 格式：**PDF only**
- A 履歷 → 下載原始上傳檔
- A CV → 暫不提供下載（純文字內容，後續討論 PDF 渲染）
- B 文件 → 暫不提供下載（AI 生成無原檔）

### 刪除規則

- 版本夾頁面**沒有刪除按鈕**
- A 履歷與 A CV 永不可刪
- B 履歷、B CV 從對應職缺的 Prepare 頁刪除（連動清掉版本夾條目）
