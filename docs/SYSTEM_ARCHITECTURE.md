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
│   │   ├── industries/        # 產業 Top 20（GET，支援 ?refresh=1）
│   │   ├── financials/        # 公司最近一季財報（GET，Yahoo Finance + 24h cache）
│   │   ├── stocks/            # 即時股價（GET，5 分鐘快取）
│   │   ├── ads/
│   │   │   └── unlock/        # 廣告解鎖（POST）
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
│   │   └── IndustryView.tsx   # 產業排行 + 股價
│   ├── subscription/
│   │   ├── AdWatcher.tsx       # 廣告觀看元件（3 則序列）
│   │   ├── PricingView.tsx     # 方案選擇頁（含取消/降級按鈕）
│   │   ├── BillingView.tsx     # 管理訂閱頁（付款方式、帳單紀錄、方案變更）
│   │   ├── PlanChangeModal.tsx # 取消/降級回饋收集 modal
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
│   └── ai/
│       ├── insights.ts        # 職缺深度分析 AI
│       ├── cv-tailor.ts       # CV 客製 AI
│       ├── resume-parser.ts   # 履歷解析 AI
│       ├── resume-analyzer.ts # 履歷 SWOT 分析 AI
│       └── match.ts           # 職缺評分 AI
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

### FinancialsCache（公司財報 24h 快取）

```prisma
model FinancialsCache {
  ticker    String   # primary key — 如 "AAPL", "2330.TW", "9984.T"
  data      Json     # QuarterlyFinancials 物件
  updatedAt DateTime
}
```

> 由 `/api/financials` 寫入，IndustryView 展開行時透過 SWR 讀取。

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

```
用戶選擇方案 → POST /api/stripe/checkout
    ↓
stripe.checkout.sessions.create()
    ↓
跳轉 Stripe 付款頁
    ↓（付款完成）
Stripe Webhook → POST /api/stripe/webhook
    ↓
checkout.session.completed
    → stripe.subscriptions.retrieve()
    → prisma.user.update({ planTier })
```

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
