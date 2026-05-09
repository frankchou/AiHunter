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
│   │   ├── resume/            # 履歷頁面
│   │   ├── industry/          # 產業 Top 100
│   │   ├── pricing/           # 升級方案頁
│   │   └── settings/          # 設定頁
│   ├── api/
│   │   ├── jobs/[id]/
│   │   │   ├── insights/      # AI 深度分析（GET/POST）
│   │   │   └── cv/            # CV 客製（GET/POST）
│   │   ├── resume/
│   │   │   ├── parse/         # 履歷解析（POST）
│   │   │   └── analyze/       # 履歷 AI 分析（POST）
│   │   ├── industries/        # 產業 Top 100（GET，支援 ?refresh=1）
│   │   ├── ads/
│   │   │   └── unlock/        # 廣告解鎖（POST）
│   │   ├── stripe/
│   │   │   ├── checkout/      # 建立付款 Session（POST）
│   │   │   ├── portal/        # Stripe 訂閱管理（POST）
│   │   │   └── webhook/       # Stripe 事件接收（POST）
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
│   │   └── ResumeView.tsx     # 履歷 + 偏好設定
│   ├── industry/
│   │   └── IndustryView.tsx   # 產業排行 + 股價
│   ├── subscription/
│   │   ├── AdWatcher.tsx      # 廣告觀看元件（3 則序列）
│   │   ├── PricingView.tsx    # 方案選擇頁
│   │   └── UpgradePrompt.tsx  # 升級提示（保留備用）
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
  planTier             String    # "free" | "pro" | "max"
  planExpiresAt        DateTime? # Stripe 訂閱到期日
  stripeCustomerId     String?   # Stripe Customer ID
  stripeSubscriptionId String?   # Stripe Subscription ID
  usageMonth           String?   # "2026-05"，月度計數器基準
  insightsUsed         Int       # 本月 AI 分析使用次數
  cvTailorsUsed        Int       # 本月 CV 客製使用次數
  analysisUsed         Int       # 本月履歷解析/分析使用次數
  adUnlocksUsed        Int       # 本月廣告解鎖次數（上限 5）
  adTickets            Int       # 解析券餘額（跨月持久）
}
```

### 計數器重置邏輯

- `insightsUsed`、`cvTailorsUsed`、`analysisUsed`、`adUnlocksUsed` 均為**惰性重置**
- 每次功能執行時比對 `usageMonth !== currentMonth()`
- 若月份不同：將當前計數器設為 1（本次）並更新 `usageMonth`
- `adTickets` 永不自動重置

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
| 產業 Top 100 | claude-haiku-4-5 | ~1K in / 6K out | ~$0.050 |
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

### 產業 Top 100 快取

- 伺服器端 DB 快取：7 天 TTL（IndustryCache model）
- Free 用戶：只能使用快取版本
- Pro/Max：可強制刷新（`?refresh=1`），免費
- Free + 有解析券：消耗 3 張券後可強制刷新

---

## 安全機制

| 項目 | 實作方式 |
|------|---------|
| 路由保護 | getServerSession() 在每個 API route |
| Owner bypass | 比對 email === OWNER_EMAIL（環境變數）|
| Stripe Webhook | stripe.webhooks.constructEvent()（簽名驗證）|
| 廣告解鎖防刷 | 服務端 adUnlocksUsed 月度計數（max 5）|
| 產業刷新門控 | consumeUsage("industryRefresh") 伺服器端驗證 |

> ⚠️ 目前廣告解鎖 API 未串接真實廣告 SDK 驗證 token，生產環境上線前需整合 Google AdSense Rewarded 或 AdMob，在 `AdWatcher.tsx` 的廣告區域替換模擬計時器。
