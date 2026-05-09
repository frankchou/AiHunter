# AiHunter 系統機制說明

## 一、方案與功能限制

### 方案等級

| 方案 | 月費 | AI 深度分析 | CV 客製 | 履歷解析/分析 | 產業刷新 | 廣告解鎖 |
|------|------|------------|---------|-------------|---------|---------|
| **Free** | 免費 | 3 次/月 | 1 次/月 | 3 次/月 | 需解析券 | ✅ |
| **Pro** | $9.9 | 30 次/月 | 15 次/月 | 15 次/月 | 無限 | ❌ |
| **Max** | $29.9 | 無限 | 無限 | 無限 | 無限 | ❌ |

> **Owner 帳號**（`OWNER_EMAIL` 環境變數，預設 frank200231@gmail.com）：跳過所有限制，無限使用所有功能。

---

## 二、解析券（Ticket）系統

### 概念

解析券是 Free 方案用戶突破月度限制的補充額度，透過觀看廣告獲得，各功能消耗數量不同。

### 票券定價

| 功能 | 消耗解析券 |
|------|-----------|
| 職缺 AI 深度分析（Insight）| 1 張 |
| CV 客製（CV Tailor）| 1 張 |
| 履歷解析（Resume Parse）| 1 張 |
| 履歷 AI 分析（Resume Analyze）| 1 張 |
| 產業 Top 100 強制刷新 | 3 張 |

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

1. 用戶點擊「升級方案」→ POST /api/stripe/checkout
2. 建立或取用既有 Stripe Customer（以 `stripeCustomerId` 關聯）
3. 建立 Checkout Session（subscription 模式），metadata 帶入 `userId + tier`
4. 跳轉 Stripe 付款頁
5. 付款完成 → Webhook `checkout.session.completed` → 更新 `planTier`

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
