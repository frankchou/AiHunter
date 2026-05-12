# AiHunter 系統架構

## 技術棧

| 層次 | 技術 |
|------|------|
| 框架 | Next.js 14（App Router）|
| 語言 | TypeScript |
| 資料庫 | Neon PostgreSQL（serverless）|
| ORM | Prisma 5.22 |
| 認證 | NextAuth.js（Google OAuth）|
| AI | Anthropic Claude SDK（Haiku / Sonnet）|
| 付款 | Stripe（subscription）|
| 前端狀態 | SWR（stale-while-revalidate）|
| 部署 | Vercel（推薦）|

---

## 目錄結構

```
AiHunter/
├── app/
│   ├── (dashboard)/           # 需登入的頁面群組
│   │   ├── feed/              # 職缺流
│   │   ├── saved/             # 我的收藏
│   │   ├── resume/            # 履歷頁面（A 根履歷的編輯入口）
│   │   ├── resumes/           # 履歷版本夾（Max only，唯讀列表 + 預覽 + 下載）
│   │   ├── industry/          # 產業 Top 20
│   │   ├── pricing/           # 升級方案頁（含取消/降級入口）
│   │   └── settings/          # 設定頁
│   │       └── billing/       # 管理訂閱（付款方式、帳單紀錄、降級/取消）
│   ├── api/
│   │   ├── jobs/[id]/
│   │   │   ├── insights/        # AI 深度分析（GET/POST）
│   │   │   ├── cv/              # B 針對性履歷（ResumeTailor），Max only（GET/POST/DELETE）
│   │   │   └── cover-letter/    # B 針對性 CV，Max only（GET/POST/DELETE）
│   │   ├── resume/
│   │   │   ├── parse/           # 履歷解析（POST，A 履歷新版本入口）
│   │   │   ├── analyze/         # 履歷 AI 分析（POST）
│   │   │   └── versions/        # 履歷與 CV 版本夾合併清單（GET，Max only）
│   │   ├── cover-letter/        # A CV 儲存/讀取（GET/POST，全 plan）
│   │   │   └── draft/           # AI 起草/建議（POST，消耗 analysis 配額）
│   │   ├── industries/        # 產業 Top 20（GET，?refresh=1 時也 probe Adzuna jobCount）
│   │   ├── companies/[name]/jobs/ # Top 20 modal：GET 撈頁 / POST 解鎖或重新計算（per-user）
│   │   ├── financials/        # 公司最近一季財報（GET，Yahoo Finance + 24h cache）
│   │   ├── stocks/            # 即時股價（GET，5 分鐘快取）
│   │   ├── ads/
│   │   │   └── unlock/        # 廣告解鎖（POST）
│   │   ├── salary/            # 薪資查詢（GET，全 plan 免費，不過 gate）
│   │   │                       #   TW: Twinkle Hub → 勞動部；外國: Adzuna 既有 Job 表彙整
│   │   ├── chat/
│   │   │   └── threads/         # AI 共創履歷對話 thread + message + apply（Max only）
│   │   ├── stripe/
│   │   │   ├── checkout/      # 建立付款 Session（POST）
│   │   │   ├── portal/        # Stripe Customer Portal（用於更新付款方式）
│   │   │   ├── subscription/  # 目前方案 + pending change 摘要（GET）
│   │   │   ├── invoices/      # 用戶歷史發票（GET）
│   │   │   ├── cancel/        # 期末取消訂閱 + 收集回饋（POST）/ 還原（DELETE）
│   │   │   ├── downgrade/     # Max→Pro 期末降級（POST）/ 還原（DELETE）
│   │   │   └── webhook/       # Stripe 事件接收（POST，含 schedule 事件）
│   │   ├── saved/             # 收藏管理（GET/POST/DELETE）
│   │   ├── crawl/             # 職缺爬取（POST）
│   │   └── user/
│   │       └── profile/       # 用戶方案資料（GET）
│   └── (auth)/
│       └── login/             # Google 登入
├── components/
│   ├── jobs/
│   │   ├── JobFeed.tsx        # 職缺流（SWR）
│   │   ├── JobCard.tsx        # 職缺卡片
│   │   ├── JobDetail.tsx      # 職缺詳情 + AI 分析
│   │   └── SavedBoard.tsx     # 收藏看板
│   ├── resume/
│   │   ├── ResumeView.tsx     # 履歷 + CV 編寫 + 偏好設定（A 履歷與 A CV 編輯）
│   │   └── VersionFolderView.tsx # 履歷+CV 版本夾頁面（Max only，分兩區塊）
│   ├── industry/
│   │   ├── IndustryView.tsx          # 產業排行 + 股價 + 工作機會 (N) badge
│   │   └── CompanyJobsModal.tsx      # 點 badge 開的 Fancybox 風格 modal（分頁 + 解鎖 + 重新計算）
│   ├── cocreate/
│   │   ├── CoCreateButton.tsx # 右下浮動按鈕（Max-only）
│   │   └── CoCreatePanel.tsx  # 共創對話面板（桌機側拉 / 手機全螢幕 sheet）
│   ├── salary/
│   │   └── SalaryView.tsx     # 薪資查詢頁。SWR fetch key 只跟 (country, industry, occupation) 走；
│   │                          #   companyType / experience / titleQuery / salary input / currency
│   │                          #   全部前端 useMemo 即時算 → 切 filter / 打數字都不 refetch、不閃。
│   │                          #   Adzuna 樣本 P25/P50/P75 + 自評百分位都在 client 算。
│   │                          #   TW 政府資料無 companyType/experience 維度，UI 顯示但 disabled。
│   │                          #   Foreign 自評支援 TWD ↔ 在地幣切換（USD/GBP/EUR/AUD）。
│   ├── subscription/
│   │   ├── AdWatcher.tsx       # 廣告觀看元件（3 則序列）
│   │   ├── PricingView.tsx     # 方案選擇頁（含取消/降級按鈕；TWD 顯示）
│   │   ├── BillingView.tsx     # 管理訂閱頁（付款方式、帳單紀錄、方案變更）
│   │   ├── PlanChangeModal.tsx # 取消/降級兩階段 modal（Impact 警告 → Feedback 收集）
│   │   └── UpgradePrompt.tsx   # 升級提示（保留備用）
│   ├── settings/
│   │   └── SettingsView.tsx   # 設定頁（方案資訊）
│   └── layout/
│       └── AppShell.tsx       # 側欄 + Header
├── lib/
│   ├── plans.ts               # 方案定義 + 票券成本 + 廣告設定
│   ├── billing.ts             # consumeUsage() — 計費核心邏輯
│   ├── stripe.ts              # Stripe 客戶端
│   ├── prisma.ts              # Prisma 客戶端（singleton）
│   ├── auth.ts                # NextAuth 設定
│   ├── utils.ts               # 工具函式
│   ├── ai/
│   │   ├── insights.ts        # 職缺深度分析 AI
│   │   ├── cv-tailor.ts       # CV 客製 AI
│   │   ├── resume-parser.ts   # 履歷解析 AI
│   │   ├── resume-analyzer.ts # 履歷 SWOT 分析 AI
│   │   └── match.ts           # 職缺評分 AI
│   └── salary-sources/        # 薪資資料 driver 層（每個源獨立檔案）
│       ├── industry-mapping.ts # 我們 37 產業 → 政府 17 行業大類對照
│       ├── twinkle.ts         # Twinkle Hub / 勞動部 抓取 + 加權平均
│       ├── adzuna-aggregate.ts # fetchAdzunaSalaryRows()：撈 Job 表 + 預分類 companyType
│       │                       #   + FX→TWD + 剔異常值 → 回 raw rows 給前端 filter。
│       │                       #   FX_TO_TWD 寫死於此（USD/GBP/EUR/AUD/JPY 等）。
│       └── company-types.ts   # 6 個 CompanyType bucket + zh-TW label
├── scripts/
│   └── seed-company-classifications.mjs # 公司分類種子（209 間，可擴充）
├── prisma/
│   └── schema.prisma          # 資料庫 Schema
└── docs/
    ├── SYSTEM_MECHANISM.md    # 本系統機制說明
    └── SYSTEM_ARCHITECTURE.md # 本架構文件
```

---

## 資料庫 Schema（核心模型）

### User

```prisma
model User {
  id                   String    # NextAuth 用戶 ID
  email                String    # Google 帳號 Email
  isSuperUser          Boolean   # true → 跳過所有計費限制（直接 DB 設定）
  planTier             String    # "free" | "pro" | "max"
  planExpiresAt        DateTime? # Stripe 訂閱到期日
  stripeCustomerId     String?   # Stripe Customer ID
  stripeSubscriptionId String?   # Stripe Subscription ID
  stripeScheduleId     String?   # Active subscription schedule (期末降級用)
  pendingPlanTier      String?   # "free"=已排取消、"pro"=已排降級、null=無
  pendingPlanAt        DateTime? # 取消/降級生效時間（period end）
  usageMonth           String?   # "2026-05"，月度計數器基準
  insightsUsed         Int       # 本月 AI 分析使用次數
  cvTailorsUsed        Int       # （遺留欄位，CV Tailor 已升 Max 旗艦無配額）
  analysisUsed         Int       # 本月履歷解析/分析使用次數
  adUnlocksUsed        Int       # 本月廣告解鎖次數（上限 5）
  adTickets            Int       # 解析券餘額（跨月持久）
}
```

### Resume（A 履歷與其歷史快照）

```prisma
model Resume {
  id          String    # cuid
  userId      String
  version     Int       # 由 1 起遞增
  fileName    String?   # 使用者上傳的原始檔名
  fileData    String?   # base64 原檔（供版本夾下載）
  fileMime    String?
  rawText     String    # 解析後純文字
  parsed      Json      # 解析後結構化內容
  parsedHash  String?   # 內容 hash，避免重複 AI 分析
  analysis    Json?     # 履歷 AI 分析結果快取
  isActive    Boolean   # true = 當前最新版（每位 user 僅一筆 isActive=true）
  createdAt   DateTime
}
```

> A 履歷一旦上傳即不可刪除（系統根資料）。重新上傳/儲存時：標記舊 row `isActive=false`，建新 row `isActive=true` 且 version+1。

### CoverLetter（A CV 與其歷史快照，新增）

```prisma
model CoverLetter {
  id        String    # cuid
  userId    String
  version   Int       # 由 1 起遞增
  fileName  String?   # 系統命名 <UserName>_cv.pdf
  content   String    # 純文字內容（自由敘事）
  isActive  Boolean   # true = 當前最新版
  createdAt DateTime
}
```

> A CV 不可刪除。儲存或 AI 起草都建立新 row 並覆蓋。

### ResumeTailor（B 針對性履歷，Max only；原 `CVTailor` 改名）

```prisma
model ResumeTailor {
  id        String    # cuid
  userId    String
  jobId     String
  fileName  String?   # 英文 Company_JobTitle_YYYY-MM-DD_Name_resume.pdf
  isCurrent Boolean   # true = 該 (user, job) 的最新版
  summary   Json      # { before, after }
  bullets   Json      # [{ before, after }, ...]
  diffNote  String
  createdAt DateTime
  updatedAt DateTime
  @@index([userId, jobId, isCurrent])
}
```

### CoverLetterTailor（B 針對性 CV，Max only，新增）

```prisma
model CoverLetterTailor {
  id        String    # cuid
  userId    String
  jobId     String
  fileName  String?   # 英文 Company_JobTitle_YYYY-MM-DD_Name_cv.pdf
  isCurrent Boolean   # true = 該 (user, job) 的最新版
  content   String    # 純文字內容
  createdAt DateTime
  updatedAt DateTime
  @@index([userId, jobId, isCurrent])
}
```

### JobScore（Top 20 modal 的 per-user-job 評分快取，新增）

```prisma
model JobScore {
  id         String   # cuid
  userId     String
  jobId      String
  parsedHash String   # 評分當下的履歷指紋（履歷有新版本 → 此分數視為過期）
  score      Float    # 0..1
  reasons    String[]
  createdAt  DateTime
  @@unique([userId, jobId])
}
```

> 跟 `Job.score`（職缺流用、generic）完全獨立。一筆 (user, job) 永久存在，除非 user 重傳履歷 → parsedHash 不符 → UI 顯 🔒 + 「請重新計算」。

### CompanyUnlockUsage（Pro 月度免費解鎖配額，新增）

```prisma
model CompanyUnlockUsage {
  id            String   # cuid
  userId        String
  company       String   # 公司名（與 Job.company 比對用）
  month         String   # "YYYY-MM"（UTC）
  pagesUnlocked Int      # 該月該公司已解鎖頁數
  @@unique([userId, company, month])
}
```

> Pro 用戶每月每家公司前 2 頁免費；超過 → 拒絕（不接受券支付）→ 升 Max 或等下月。Free 不需此表（用 ticket）。Max 不需此表（無限）。

### FinancialsCache（公司財報 24h 快取）

```prisma
model FinancialsCache {
  ticker    String   # primary key — 如 "AAPL", "2330.TW", "9984.T"
  data      Json     # QuarterlyFinancials 物件
  updatedAt DateTime
}
```

> 由 `/api/financials` 寫入，IndustryView 展開行時透過 SWR 讀取。

### SalaryCache（薪資查詢的 Twinkle Hub 結果快取）

```prisma
model SalaryCache {
  id        String   # cuid
  datasetId String   # 政府資料集 ID（41685, 41692, ...）
  year      String   # 西元年（"2024"）
  data      Json     # SalarySnapshot（rows + meta）
  createdAt DateTime
  @@unique([datasetId, year])
}
```

> TTL 7 天；同產業重複查詢直接讀。Twinkle Alpha 階段免費但避免重複呼叫。

### CompanyClassification（公司類別對照表 — Phase 2）

```prisma
model CompanyClassification {
  companyName String   # primary key；與 Adzuna `display_name` 大小寫不敏感 contains 比對
  companyType String   # foreign_tier1 | foreign_traditional | tw_local
                       # large_enterprise | sme | startup
  region      String?  # 國家代碼（"US", "TW", "JP" 等，提供顯示用，非過濾依據）
}
```

> 由 [scripts/seed-company-classifications.mjs](../scripts/seed-company-classifications.mjs) 一次 seed 209 間。`/api/salary` 外國 mode 載入**全部**分類 rows 一次 → 為每筆 Job 用 `companyName.toLowerCase()` contains 比對標上 `companyType`，跟著 raw row 一起回傳前端。前端依使用者選的 `companyType` 在 client 過濾，不再額外查 DB。為 Adzuna「不索引此雇主」修補：seed 同一公司可加多筆別名（`Google` + `Alphabet` / `Meta` + `Facebook`）。

### ResumeChat / ResumeChatMessage（AI 共創對話 + 提案，Max only）

```prisma
model ResumeChat {
  id        String              # cuid
  userId    String
  title     String              # 自首則 user message 截 40 字
  docKind   String              # "resume-a" | "cv-a" | "resume-b" | "cv-b" | "general"
  jobId     String?             # B 文件對應的 jobId
  createdAt DateTime
  updatedAt DateTime
  messages  ResumeChatMessage[]
}

model ResumeChatMessage {
  id          String   # cuid
  chatId      String
  role        String   # "user" | "assistant"
  content     String   # 對話文字
  editTarget  String?  # AI 提案的目標欄位（如 "summary", "bullet:0:1", "content"）
  editBefore  String?  # 提案前文字
  editAfter   String?  # 提案後文字
  applied     Boolean  # 使用者是否已套用此提案
  createdAt   DateTime
}
```

> 每位使用者最多保留 30 個 chat（依 `updatedAt` 倒序，超過刪最舊）。每個 chat 是獨立 thread，不共享記憶。提案套用會直接寫回對應的源文件並新增版本。

### CancellationFeedback（取消/降級原因收集）

```prisma
model CancellationFeedback {
  id            String   # cuid
  userId        String
  fromTier      String   # "pro" | "max"
  toTier        String   # "free" | "pro"
  reasons       String[] # multi-select keys, e.g. ["price","not_using"]
  freeText      String?  # 自由填寫
  effectiveAt   DateTime?  # 期末生效時間
  createdAt     DateTime
}
```

> 每次成功提交取消/降級時建立一筆。後續可從這張表 dashboard 看「為何離開」的趨勢來指導產品改進。

> B 文件同 (userId, jobId) 重新產生 → 舊 row `isCurrent=false`、建新 row `isCurrent=true`。從 Prepare 頁刪除 → 物理刪除整組 (userId, jobId) 的所有 row。**A 永不可刪**。

### 計數器重置邏輯

- `insightsUsed`、`analysisUsed`、`adUnlocksUsed` 均為**惰性重置**
- 每次功能執行時比對 `usageMonth !== currentMonth()`
- 若月份不同：將當前計數器設為 1（本次）並更新 `usageMonth`
- `adTickets` 永不自動重置
- `cvTailorsUsed` 已不再使用（CV Tailor 改為 Max tier-gated，無配額制）

---

## 核心資料流

### AI 功能執行流程

```
前端按鈕 → POST /api/jobs/[id]/insights
    ↓
consumeUsage(userId, "insight")        ← lib/billing.ts
    ├─ Owner bypass
    ├─ 免費額度檢查（insightsUsed < 3）
    ├─ 解析券扣除（adTickets >= 1）
    └─ 402 拒絕
    ↓（通過）
generateInsight(job, resume)           ← lib/ai/insights.ts
    ↓
Claude API（claude-haiku-4-5）
    ↓
prisma.insight.upsert()
    ↓
回傳 JSON → SWR mutate → 前端渲染
```

### 廣告解鎖流程

```
LimitBanner 顯示（limit.adSessionsLeft > 0）
    ↓
用戶點擊「看廣告」
    ↓
AdWatcher 元件（3 則 × 30 秒）
    ↓（全程觀看）
POST /api/ads/unlock
    ├─ 檢查 adUnlocksUsed < 5
    ├─ adTickets += 1
    └─ adUnlocksUsed += 1
    ↓
onComplete() → 自動重試原 AI 功能
```

### Top 20 公司職缺評分流程（新）

```
[使用者點「強制更新」]（3 張券 / Pro+Max 免費）
/api/industries?refresh=1
  ├─ AI 生成 Top 20 公司清單
  ├─ 並行：對每間公司 probeCompanyJobCount(name, regionCountries)
  │     └─ Adzuna 回 `count`（1 query/國家，超輕量）
  └─ 寫入 IndustryCache：data.companies[i].jobCount = N

[平常瀏覽產業頁]
/api/industries?industry=ai
  └─ 讀 IndustryCache → 直接回傳含 jobCount → UI 顯示「工作機會 (N)」

[點 (N) → 開 CompanyJobsModal]
  └─ GET /api/companies/[name]/jobs?page=1
       ├─ 撈 Job 表該公司 page 1（10 筆）
       ├─ 若 page 1 為空 → 即時 Adzuna fetch + upsert Job 表
       ├─ JOIN JobScore[userId, jobId]
       │   ├─ 找到且 parsedHash 一致 → 帶分數
       │   └─ 找不到 / hash 不符 → locked: true
       └─ 回傳 jobs + pagination + policy

[使用者按「解鎖此頁分數」]
  └─ POST /api/companies/[name]/jobs { page: 1 }
       ├─ consumeCompanyScoring(userId, companyName)
       │   ├─ Free: 扣 1 ticket
       │   ├─ Pro:  查 CompanyUnlockUsage 此月此公司 < 2 → 允許 + increment
       │   │       否則回 PRO_QUOTA_EXCEEDED
       │   └─ Max:  直接允許
       ├─ 平行 scoreJob(j, resume, prefs) × 10
       └─ upsert JobScore × 10（帶當下 parsedHash）

[使用者按「重新計算」]（Pro/Max 才看得到）
  └─ POST /api/companies/[name]/jobs { page: 1, recalculate: true }
       ├─ 驗證 hash：若 JobScore.parsedHash 全等於目前 Resume.parsedHash
       │   → 拒絕 HASH_UNCHANGED（toast：「履歷沒有新版本」）
       └─ 否則：同上 unlock 流程（Pro 一樣消耗月度配額）
```

### 履歷與 CV 版本管理流程（Max only 進入版本夾與 B 文件）

```
[A 履歷編輯]
/resume → POST /api/resume
    ├─ 全 plan 可用（消耗 analysis 配額由 /api/resume/parse 處理）
    ├─ 標記既有 Resume isActive=false
    └─ 建立新 Resume row（version+1, isActive=true）

[A CV 編輯 / AI 起草]
/resume → POST /api/cover-letter （手動儲存）
              POST /api/cover-letter/draft （AI 協助）
    ├─ 全 plan 可用，消耗 analysis 配額（共用 cvTailor 不適用、走 analysis）
    ├─ 標記既有 CoverLetter isActive=false
    └─ 建立新 CoverLetter row（version+1, isActive=true）

[B 針對性履歷產生]
/job/[id] Prepare → POST /api/jobs/[id]/cv
    ├─ 檢查 user.planTier === "max"，否則 403
    ├─ 取 A 履歷當前版 + Job 欄位作為輸入
    ├─ AI 產出 summary/bullets/diffNote + 英文 fileName
    ├─ 標記既有 (userId, jobId) 的 ResumeTailor isCurrent=false
    └─ 建立新 ResumeTailor row（isCurrent=true）

[B 針對性 CV 產生]
/job/[id] Prepare → POST /api/jobs/[id]/cover-letter
    ├─ 檢查 user.planTier === "max"，否則 403
    ├─ 取 A 履歷 + A CV（如有） + Job 欄位作為輸入
    ├─ AI 產出 content + 英文 fileName
    ├─ 標記既有 (userId, jobId) 的 CoverLetterTailor isCurrent=false
    └─ 建立新 CoverLetterTailor row（isCurrent=true）

[版本夾列表]
/resumes → GET /api/resume/versions
    ├─ 檢查 user.planTier === "max"，否則 403
    ├─ Resume.findMany({ userId, isActive:true }) → 1 筆 A 履歷
    ├─ CoverLetter.findMany({ userId, isActive:true }) → 1 筆 A CV
    ├─ ResumeTailor.findMany({ userId, isCurrent:true }) → N 筆 B 履歷
    ├─ CoverLetterTailor.findMany({ userId, isCurrent:true }) → N 筆 B CV
    └─ 合併分兩區塊回傳（resumes / coverLetters）

[B 刪除（從 Prepare 源頭）]
/job/[id] Prepare → DELETE /api/jobs/[id]/cv 或 cover-letter
    └─ deleteMany({ where: { userId, jobId } })
```

> A 履歷與 A CV 永遠**不可刪除**，沒有對應的 DELETE endpoint。

### 訂閱付費流程

**目前定價**：Free NT$0 / Pro NT$300 / Max NT$800（月付制，無年付）。  
**目前金流**：以 ECPay 綠界為主（台灣市場）；Stripe 程式碼保留作為未來全球化備援。

```
用戶選擇方案 → POST /api/stripe/checkout（Stripe）or /api/ecpay/subscribe（ECPay，未實作）
    ↓
建立 Checkout / 定期定額連結
    ↓
跳轉付款頁
    ↓（付款完成）
Webhook → 更新 prisma.user.planTier
```

### 取消 / 降級流程（兩階段 UI）

```
用戶按「取消訂閱」或「降級為 Pro」
    ↓
PlanChangeModal 開啟 — Step 1: Impact 警告
    ├─ 顯示「會失去什麼 / 配額會降到哪 / 會保留什麼」
    ├─ [保留方案]   ← 多數人在這步打消念頭（loss aversion）
    └─ [繼續取消/降級]
        ↓
    Step 2: Feedback 收集
    ├─ 多選原因（7 個 enum）
    ├─ 自由文字
    └─ [確認取消/降級] → POST /api/stripe/cancel 或 /downgrade
        ↓
    後端：
    ├─ cancel:    stripe.subscriptions.update({ cancel_at_period_end: true })
    ├─ downgrade: stripe.subscriptionSchedules.create() 兩階段排程
    ├─ 寫入 CancellationFeedback
    └─ 更新 user.pendingPlanTier / pendingPlanAt
        ↓
    當期結束 → Stripe webhook → user.planTier 更新
```

### 薪資查詢流程（Phase 1 + Phase 2，client-side filter）

```
進 /salary
    ↓
選國家 chip + 選產業 chip（兩者皆必填）
    ↓
GET /api/salary?country=X&industry=Y          ← 不過 billing gate、不打 AI
    ├─ JP / KR / CN → 回 hasData:false + "資料尚未開放"
    ├─ TW (gov 路徑):
    │     ├─ INDUSTRY_TO_DATASET[Y] → datasetId
    │     ├─ SalaryCache(datasetId, year) 7 天 TTL → 命中讀；miss 打 Twinkle Hub
    │     ├─ Twinkle MCP / JSON-RPC 2.0 → 勞動部 rows
    │     └─ 回 { rows: TwGovRow[], summary: 加權平均 }
    └─ Foreign (Adzuna 路徑):
          ├─ 載入全部 CompanyClassification (~209 rows)
          ├─ prisma.job.findMany ({ source:"adzuna", country IN [...], industry, salary>0 })  take 5000
          ├─ 每列 FX→TWD + 預分類 companyType + 剔離群（<100k 或 >30M）
          └─ 回 { rows: SalaryJobRow[] }  ← 不算 summary，交給 client
    ↓
SWR 收 rows（cache key 只跟 country/industry 走）
    ↓
[使用者操作] 改 filter / 改幣別 / 打輸入框數字 → NOT REFETCH
    ↓
client useMemo 即時：
    ├─ adzunaFiltered = rows.filter(companyType + experience + titleQuery)
    ├─ adzunaSummary  = P25/P50/P75/mean from adzunaFiltered
    ├─ localSelfEval  = user(monthly,annual) × FX_TO_TWD[currency] → 比 P50 → 百分位插值
    └─ 全部瞬間反映 UI
```

**架構決策**：Server 薄、Client 厚。SWR key 故意只含 `(country, industry, occupation)`；filter / 幣別 / salary input 全留前端 `useMemo` 算 → 切 filter 不打 API、不 spinner、不 flicker。代價是 response ~100-300KB（每 row ~50 bytes × 1000-5000 rows），但只在切國家 / 產業時拉一次，划得來。

---

## AI 模型使用

| 功能 | 模型 | 預估 Token | 預估成本 |
|------|------|-----------|---------|
| 職缺深度分析 | claude-haiku-4-5 | ~4K in / 2K out | ~$0.020 |
| CV 客製 | claude-haiku-4-5 | ~3K in / 1K out | ~$0.012 |
| 履歷解析 | claude-haiku-4-5 | ~2K in / 1K out | ~$0.008 |
| 履歷 AI 分析 | claude-haiku-4-5 | ~2K in / 1K out | ~$0.010 |
| 產業 Top 20 | claude-haiku-4-5 | ~1K in / 6K out | ~$0.050 |
| 職缺評分（批量）| claude-haiku-4-5 | ~1K in / 0.1K out | ~$0.003/筆 |

---

## SWR 快取策略

| API 路徑 | 快取鍵 | revalidateOnFocus |
|---------|--------|-------------------|
| /api/jobs/[id]/insights | 依 jobId | false（避免重複計費）|
| /api/jobs/[id]/cv | 依 jobId | false |
| /api/saved | /api/saved | true（雙向同步）|
| /api/user/profile | /api/user/profile | true |
| /api/stocks | 依 symbols | false |
| /api/salary | `?country=X&industry=Y[&occupation=Z]`（**不**含 filter） | false + `keepPreviousData: true` |

### 薪資查詢快取策略（client + server 雙層）

- **Server**：TW 用 `SalaryCache(datasetId, year)` 7 天 TTL；Adzuna 純讀現有 Job 表（無額外快取，Job 表本身由 job-feed pipeline 維護）
- **Client**：SWR fetch key 故意只包含 `(country, industry, occupation)`。`companyType` / `experience` / `titleQuery` / `inputCurrency` / `userMonthly` / `userAnnual` **不在 key 裡**，純前端 `useMemo` 算 → 切 filter / 改幣別 / 打數字都不重發 request。
- **架構代價**：Adzuna response 可能含 ~1000-5000 rows（每 row ~50 bytes，~100-300KB），但只在切國家或產業時拉一次。換來「切 filter 是瞬間」的 UX，划得來。

### 產業 Top 20 快取

- 伺服器端 DB 快取：7 天 TTL（IndustryCache model）
- Free 用戶：只能使用快取版本
- Pro/Max：可強制刷新（`?refresh=1`），免費
- Free + 有解析券：消耗 3 張券後可強制刷新

### 產業 Top 20 工作機會數對應

- 每間 AI 推薦公司會顯示 `工作機會 (N)` badge，N 來自當前 `Job` 表
- 比對方式：**case-insensitive `contains`**（DB 公司名常為「台達電子工業股份有限公司 _DELTA ELECTRONICS INC.」格式，AI 給「Delta Electronics」），`name` 為子字串即計入
- 點擊 badge → 用 `/api/jobs?company=<name>` 同樣 `contains` 比對載入清單
- N=0 時 badge disabled
- 若整體 N 偏低，根本原因為 crawler 來源以本地中小型公司為主，跟 AI 推薦的全球巨頭重疊度低（待擴充職源）

### 產業 Top 20 公司財報資訊

每間有 ticker 的上市公司，展開行後顯示一個「最近財報」block：
- **資料來源**：Yahoo Finance 非官方 `quoteSummary?modules=incomeStatementHistoryQuarterly` endpoint
- **快取**：`FinancialsCache` 表，TTL **24 小時**（避免每次載入頁都打 Yahoo）
- **顯示欄位**：
  - 期別（如 `Q3'25`） + 截止日 + 獲利 / 虧損 tag
  - 營收 + YoY % + QoQ %
  - 淨利 + YoY % + QoQ %（淨利字色依正負區分綠/紅）
- **私人公司（無 ticker）**：顯示「未公開財報（私人公司）」
- **Yahoo 失敗 / 無資料**：顯示「載入中或暫無資料」
- **限制**：Yahoo 為非官方 API，若格式變動需更新 fetch 程式

---

## 安全機制

| 項目 | 實作方式 |
|------|---------|
| 路由保護 | getServerSession() 在每個 API route |
| Super User bypass | `User.isSuperUser=true`（DB 欄位，非環境變數）|
| Stripe Webhook | stripe.webhooks.constructEvent()（簽名驗證）|
| 廣告解鎖防刷 | 服務端 adUnlocksUsed 月度計數（max 5）|
| 產業刷新門控 | consumeUsage("industryRefresh") 伺服器端驗證 |
| Max-only 功能門控 | API route 開頭檢查 `user.planTier === "max"`，不通過回 403（CV Tailor、版本夾）|

> ⚠️ 目前廣告解鎖 API 未串接真實廣告 SDK 驗證 token，生產環境上線前需整合 Google AdSense Rewarded 或 AdMob，在 `AdWatcher.tsx` 的廣告區域替換模擬計時器。
