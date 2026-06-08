# AI Hunter Backlog

> 集中追蹤所有待辦。每項都有兩個 checkbox：
> - **Done** — 實作完成（由 Claude 勾）
> - **Verified** — 使用者驗證通過（由 Frank 勾）
>
> 機制細節見 [SYSTEM_MECHANISM.md](./SYSTEM_MECHANISM.md) / [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)。功能型 roadmap：[SALARY_ROADMAP.md](./SALARY_ROADMAP.md)。

**圖例**：🎯 Priority · ⏱ Estimate · 📅 Target start · 👤 Owner

---

## 🚀 Pre-launch must-do

- [ ] **Done** · [ ] **Verified** — **#1 104 crawler 強化**
  - 🎯 P0 · ⏱ 14h · 📅 2026-06-09 · 👤 Claude impl → Frank verify
  - 為什麼必做：AI 配對品質決定點，跟競品的差異化武器
  - Scope:
    - 抄 [andyching168/104_mcp](https://github.com/andyching168/104_mcp) 端點規格（Python repo 不引入、TS 重寫）
    - `lib/job-sources/taiwan-104.ts` 加 `job/ajax/content/{id}` detail 二次呼叫
    - `prisma/schema.prisma` `Job` model 加 `applyCount` / `education` / `languages` / `welfare String[]` / `lat,lng` / `salaryType`
    - Rate limit：concurrency 3 + 200ms 間隔（避免被 104 封 IP）
    - `lib/ai/match.ts` 用新欄位（特別是 `applyCount` 當冷門/熱門訊號）
  - 驗證標準（Frank 勾 Verified 前要確認）：
    - 抓 10 個 104 職缺、新欄位都有值
    - `match.ts` AI 評分有把 `applyCount` 納入
    - 連續抓 100 筆沒被 IP 封
    - Typecheck pass、commit push 完成

- [ ] **Done** · [ ] **Verified** — **#2 PlanChangeModal 遷 LemonSqueezy**
  - 🎯 P0 · ⏱ 6h · 📅 2026-06-11 · 👤 Claude impl → Frank verify
  - 為什麼必做：付費用戶取消/降級目前還打 Stripe，會炸
  - Scope:
    - 新 `/api/payments/cancel` + `/api/payments/downgrade` endpoint（呼叫 LemonSqueezy `updateSubscription` 或 `cancelSubscription`）
    - PlanChangeModal 改打新 endpoint
    - 保留 churn feedback 收集（寫 `CancellationFeedback`）
  - 驗證標準：用 test mode 訂閱 → 取消 → 確認 webhook + UI 一致；降級 Max→Pro → 確認

- [ ] **Done** · [ ] **Verified** — **#3 LemonSqueezy invoices listing**
  - 🎯 P0 · ⏱ 2h · 📅 2026-06-12 · 👤 Claude impl → Frank verify
  - 為什麼必做：帳單可見性是基本需求
  - Scope:
    - 新 `/api/payments/invoices` endpoint（呼叫 LemonSqueezy `listSubscriptionInvoices`）
    - BillingView 切過去
  - 驗證標準：test mode 付一筆 → BillingView 看得到記錄 + 可下載

- [ ] **Done** · [ ] **Verified** — **#4 加 webhook events `dispute_created` / `dispute_resolved`**
  - 🎯 P0 · ⏱ 0.5h · 📅 2026-06-12 · 👤 Claude impl → Frank verify
  - 為什麼必做：信用卡爭議 chargeback 自動處理、上線後一定遇到
  - Scope:
    - LemonSqueezy dashboard 勾這兩個 events
    - `/api/payments/webhook` 加處理：dispute_created 暫停服務、dispute_resolved 視結果恢復或永久降級
  - 驗證標準：webhook 收到事件能正確處理（test mode 沒辦法觸發 dispute，這項只能 staging 驗）

---

## 🟡 Pre-launch nice-to-have

- [ ] **Done** · [ ] **Verified** — **#5 Stripe code 完整刪除**
  - 🎯 P2 · ⏱ 2h · 📅 2026-06-13 · 👤 Claude impl → Frank verify
  - Scope：刪 `app/api/stripe/*` 整個資料夾 + `lib/stripe.ts` + `User` schema 拿掉 `stripeCustomerId` `stripeSubscriptionId` `stripeScheduleId` + migration
  - 驗證：typecheck pass、grep 確認沒殘留 import

- [ ] **Done** · [ ] **Verified** — **#6 SYSTEM_MECHANISM.md 第六章重寫**
  - 🎯 P2 · ⏱ 1h · 📅 2026-06-13 · 👤 Claude impl → Frank verify
  - Scope：把「六、訂閱付費（Stripe）」整章換成 LemonSqueezy
  - 驗證：閱讀通順、跟現況一致

- [ ] **Done** · [ ] **Verified** — **#7 LemonSqueezy e2e 完整測試**
  - 🎯 P1 · ⏱ 1h · 📅 2026-06-14 · 👤 Frank（要建立 non-super-user 帳號或暫關 isSuperUser）
  - Scope：升 Pro → 降 Pro→Free → 重升 Max → 變更卡片 → 取消
  - 驗證：每一步 webhook 都正確、DB 同步、UI 顯示對

---

## 📦 Phase 2: 通知系統（上線後第一個月）

> [SettingsView](../components/settings/SettingsView.tsx) toggle 已預埋（disabled 灰底「即將推出」），DB 也有 `Preference.pushEnabled` / `emailDigestEnabled` 欄位等著接。

- [ ] **Done** · [ ] **Verified** — **#8 Email digest**
  - 🎯 P1 · ⏱ 4h · 📅 上線後 +7 天 · 👤 Claude impl → Frank verify
  - Scope：[Resend](https://resend.com)（3000 封/月免費）+ Vercel Cron Jobs 每日 09:00；對每個 `emailDigestEnabled=true` 的用戶寄符合 `minScore` 的新職缺 top 10
  - 驗證：寄到自己信箱、確認 unsubscribe link 也通

- [ ] **Done** · [ ] **Verified** — **#9 瀏覽器推播**
  - 🎯 P2 · ⏱ 8h · 📅 上線後 +14 天 · 👤 Claude impl → Frank verify
  - Scope：Service Worker + Web Push API + VAPID keys；新職缺即時推送
  - 驗證：自己授權、收到通知

---

## 🎯 職涯歷程規劃（中長期）

> 設計：使用者輸入 2050 目標（產業 + 職位）→ AI 生 5-7 個職涯里程碑 → 職缺流推薦對齊目前階段。Max 無限、Pro 月 2 次、Free 看不到入口。命盤 opt-in。

- [ ] **Done** · [ ] **Verified** — **#10 Phase 1: 純路徑 MVP**
  - 🎯 P2 · ⏱ 8h · 📅 上線後留存穩定後（2026-07?） · 👤 Claude impl → Frank verify
  - **Pre-work（啟動前 Frank 要決定）**：
    - [ ] (a) **先寫 design doc** — Claude 把架構 + AI prompt + DB schema + UI flow 寫成 `docs/CAREER_ROADMAP_DESIGN.md` 過目，過目後再動 code（~2h）
    - [ ] (b) **直接開做** — 接受邊做邊調整、scope 可能會在中途被你 challenge
  - Scope：`CareerRoadmap` model + AI prompt + 設目標 wizard + timeline UI + JobFeed 對齊路徑加分（Max only）+ `consumeUsage("roadmap")` gate
  - 驗證：設個假目標跑一次、看 AI 輸出合理

- [ ] **Done** · [ ] **Verified** — **#11 Phase 2: 性格測驗（Big 5 短 10 題）**
  - 🎯 P3 · ⏱ 16h · 📅 #10 完成後 · 👤 Claude impl → Frank verify

- [ ] **Done** · [ ] **Verified** — **#12 Phase 3: 命盤 opt-in**
  - 🎯 P3 · ⏱ 24h · 📅 #11 完成後 · 👤 Claude impl → Frank verify
  - Scope：生辰輸入 → BaZi/紫微 解析 → 入 AI prompt 維度。命盤 lib 評估或第三方 API
  - 驗證：自己生辰丟進去、輸出合理（不會幻覺）

- [ ] **Done** · [ ] **Verified** — **#13 Phase 4: 重規劃 + 路徑視覺化進階**
  - 🎯 P3 · ⏱ 16h · 📅 #12 完成後 · 👤 Claude impl → Frank verify
  - Scope：Gantt-like timeline、改目標後 diff、舊路徑歷史

---

## 🎨 Quality polish（用戶反饋驅動）

- [ ] **Done** · [ ] **Verified** — **#14 Anti-slop pattern**（借 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)）
  - 🎯 P3 · ⏱ 6h · 📅 收到「AI 輸出有樣板感」反饋後 · 👤 Claude impl → Frank verify
  - Scope：`insights.ts` 加 banned phrases；`cover-letter.ts` / `resume-tailor.ts` 加 AI Tells ban；fork SKILL.md 給 ui/art-designer subagent 當參考
  - 驗證：前後比對 AI 輸出，廢話減少

---

## ✅ 近期已完成（不需驗證、僅作記錄）

- [x] LemonSqueezy 訂閱整合 MVP — `fd62969` (2026-05-12)
- [x] Settings/Pricing/Billing UX + minScore filter + super user remap + plan-aware usage card — `19fa65f` (2026-05-12)
- [x] 完整重做登入登出鏈、根治 CSRF race — `15115a0` + `689ad2e` (2026-05-12)
- [x] 系統文件補登入登出機制 — `3f8dc2f` (2026-05-12)
- [x] 薪資查詢 Phase 1 + 2 — 見 git log（更早）

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

## 執行順序（建議）

1. **#1 104 crawler 強化** ← 從這個開始（上線競爭力）
2. **#2~#4** LemonSqueezy 收尾（付費鏈完整）
3. **上線**（公開 launch）
4. 觀察 1-2 週 → **#8 Email digest**
5. 觀察留存 → 決定 **#10 職涯規劃 MVP** 啟動時機
6. 其他按優先序

---

## 維護規則

- Claude 完成實作 → 勾 **Done**、commit message 提一下
- Frank 測試通過 → 勾 **Verified**、可以 push 到 main
- 新增 item → 加在對應 phase、給 priority + estimate + target start
- 改變優先序 → 移動位置 + 更新 target start
- 已完成的 item → 移到「近期已完成」section（保留歷史）
- **複雜 item 啟動前**（P2 以上 + estimate > 4h、或新功能）→ Claude 在該 item 下提**「先寫 design doc」vs「直接做」**兩個選項，Frank 勾完才開工，避免 scope 失控
