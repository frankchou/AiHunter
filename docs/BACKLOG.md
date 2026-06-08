# AI Hunter Backlog

> 集中記錄上線前必做、上線後排程、與長期 roadmap。實作機制細節見 [SYSTEM_MECHANISM.md](./SYSTEM_MECHANISM.md) 與 [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)。功能型 roadmap（已完成階段細節）：[SALARY_ROADMAP.md](./SALARY_ROADMAP.md)。

---

## 🚀 Pre-launch must-do（上線前必做）

| # | 項目 | 工時 | 為什麼必做 |
|---|---|---|---|
| 1 | **104 crawler 強化** — 抄 [andyching168/104_mcp](https://github.com/andyching168/104_mcp) 的端點規格自己重寫（Python 不引入），加 `job/ajax/content/{id}` detail 二次呼叫；`Job` schema 加 `applyCount` / `education` / `languages` / `welfare` / `lat,lng` / `salaryType`；rate limit（concurrency 3 + 200ms 間隔）；`match.ts` 用新欄位 | 14h | AI 配對品質直接受影響、和競品的差異點 |
| 2 | **PlanChangeModal 遷 LemonSqueezy** — 目前還打 `/api/stripe/cancel` `/api/stripe/downgrade`，付費用戶用會炸 | 6h | LemonSqueezy 訂閱戶取消/降級會壞 |
| 3 | **LemonSqueezy invoices listing** — BillingView 帳單列表還用 Stripe，LemonSqueezy 用戶看不到帳單 | 2h | 帳單可見性是基本需求 |
| 4 | **加 webhook events `dispute_created` / `dispute_resolved`** — 信用卡爭議自動處理 | 0.5h | 風控、上線後一定會遇到 chargeback |

**Subtotal: ~22.5h ≈ 3 工作日**

---

## 🟡 Pre-launch nice-to-have（有空可做）

| # | 項目 | 工時 |
|---|---|---|
| 5 | Stripe code 完整刪除（`app/api/stripe/*` + `User` schema 拿掉 `stripe*` 欄位） | 2h |
| 6 | SYSTEM_MECHANISM.md 第六章「訂閱付費（Stripe）」重寫為 LemonSqueezy | 1h |
| 7 | LemonSqueezy e2e 完整測試（需 non-super-user 帳號臨時關閉 isSuperUser） | 1h |

---

## 📦 Phase 2: 通知系統（上線後第一個月）

> [SettingsView](../components/settings/SettingsView.tsx) 的 toggle 已預埋（disabled 灰底「即將推出」），DB 也有 `Preference.pushEnabled` / `emailDigestEnabled` 欄位等著接。

| # | 項目 | 工時 |
|---|---|---|
| 8 | **Email digest** — Resend (3000 封/月免費) + Vercel Cron Jobs；每日寄符合 `minScore` 的新職缺給開了 `emailDigestEnabled` 的用戶 | 4h |
| 9 | **瀏覽器推播** — Service Worker + Web Push API + VAPID keys；同上條件、即時發送 | 8h |

---

## 🎯 職涯歷程規劃（中長期，2050 目標 + 路徑規劃）

> 設計：使用者輸入 2050 目標（產業 + 職位）→ AI 生 5-7 個職涯里程碑 → 職缺流推薦對齊目前階段。Max 無限、Pro 月 2 次、Free 看不到入口。命盤是 opt-in、不打開就不用。

| # | 項目 | 工時 |
|---|---|---|
| 10 | **Phase 1: 純路徑 MVP** — `CareerRoadmap` model、AI prompt、設目標 wizard、timeline UI、JobFeed 對齊路徑加分（Max only）、`consumeUsage("roadmap")` gate | 8h |
| 11 | Phase 2: 性格測驗（Big 5 短 10 題），結果餵 AI prompt | 16h |
| 12 | Phase 3: 命盤 opt-in（生辰 → BaZi/紫微 解析 → 入 AI prompt 維度） | 24h |
| 13 | Phase 4: 重規劃 / 路徑視覺化進階（Gantt-like timeline） | 16h |

**Subtotal: ~64h ≈ 8 工作日**

---

## 🎨 Quality polish（隨時可做、非阻斷）

| # | 項目 | 工時 |
|---|---|---|
| 14 | **Anti-slop pattern**（借 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)）— `insights.ts` 加 banned phrases；`cover-letter.ts` / `resume-tailor.ts` 加 AI Tells ban；fork `SKILL.md` 給 ui/art-designer subagent 當參考 | 6h |

> 等真實用戶反饋 AI 輸出有 slop 感再做、避免提早優化。

---

## ✅ 近期已完成（2026-05-12 一日內）

| 項目 | Commit |
|---|---|
| LemonSqueezy 訂閱整合（test mode 可跑） | `fd62969` |
| Settings/Pricing/Billing UX 修正 + `minScore` filter + super user remap + plan-aware usage card | `19fa65f` |
| 完整重做登入登出鏈、根治 CSRF race | `15115a0` + `689ad2e` |
| 系統文件補登入登出機制 | `3f8dc2f` |
| 薪資查詢 Phase 1 + 2 | 見 git log（更早） |

---

## 工時統計

| 區段 | 工時 | 天數估計 |
|---|---|---|
| 上線前 must-do | 22.5h | ~3 |
| 上線前 nice-to-have | 4h | ~0.5 |
| Phase 2 通知系統 | 12h | ~1.5 |
| 職涯歷程規劃 | 64h | ~8 |
| Quality polish | 6h | ~0.75 |
| **總計** | **108.5h** | **~13.5 天** |

---

## 優先順序建議

1. 先做 **#1 104 crawler 強化**（AI 配對品質、上線競爭力）
2. 再做 **#2~#4 LemonSqueezy 收尾**（付費鏈完整）
3. 上線
4. 觀察 1-2 週後做 **Phase 2 通知系統**
5. 觀察用戶留存後決定 **職涯歷程規劃** 啟動時機
