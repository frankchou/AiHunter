# 薪資查詢功能 Roadmap

> 本文件記錄 `/salary` 功能的 Phase 1 + Phase 2 完成範圍，與 Phase 3 待辦清單。實際機制細節參考 [SYSTEM_MECHANISM.md](./SYSTEM_MECHANISM.md#薪資查詢phase-1--phase-2) 的「薪資查詢」section，架構參考 [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)。

---

## 已完成範圍速覽

### Phase 1（已上線）— TW 政府公開資料

- ✅ Twinkle Hub → 勞動部 17 個產業 dataset
- ✅ 我們 37 產業 → 政府 17 大類 mapping
- ✅ `SalaryCache(datasetId, year)` 7 天 TTL
- ✅ 產業 × 職類別 表 + 加權平均月薪 / 年薪 / 樣本

### Phase 2（已上線）— 海外 Adzuna 彙整 + Client-side filter 架構

- ✅ `fetchAdzunaSalaryRows()` driver（FX→TWD + 預分類 + 剔離群）
- ✅ Server 薄 / Client 厚拆分：SWR fetch key 只跟 (country, industry, occupation) 走
- ✅ `CompanyClassification` 表 + seed 209 間
- ✅ 6 個 CompanyType bucket（dropdown 依國家動態裁切）
- ✅ 5 段年資 bucket（Adzuna `yearsMin/yearsMax` overlap）
- ✅ 國家：TW（gov）+ US/UK/AU/EU（Adzuna）；JP/KR/CN 灰 chip
- ✅ 職位搜尋（TW: filter 職類別 / Adzuna: filter title）
- ✅ 自評卡：月薪 + 年薪 + 年資 select（TW disabled）+ 幣別切換（TWD ↔ USD/GBP/EUR/AUD）
- ✅ Client-side 算 P25/P50/P75 + 百分位 + filter context label
- ✅ Industry 強制必填、Empty state 文案區分

---

## Phase 3 待辦清單

### A. 資料維度補完

| ID | 項目 | 來源 | 工程量 | 目的 |
|----|------|------|-------|------|
| **A1** | **TW 年資維度** | 主計總處「人力運用調查」或自建履歷年資資料庫 | 1-3 天 | 讓 TW 也能依「3-7 年」「10+ 年」分群比較；目前 TW 年資 select 是 disabled |
| **A2** | **JP/KR/CN 在地薪資** | LinkedIn / 當地求職平台 / 在地 gov 公開資料 | 2-3 天/國 | 填滿亞洲灰 chip。目前 chip 灰、點了顯示「資料尚未開放」 |
| **A3** | **證照 / 作品 / 學歷分群** | AI 解析 `Resume.parsedData`（已有此資料） | 1-2 天 | 使用者標「有 AWS 證照」「有 GitHub 作品」可看更精準薪資 |
| **A4** | **海外職類別分類** | AI 把 Adzuna 自由文字 title 分類成 ~10-15 bucket（SE / DS / PM / Designer / ...） | 1 天 | 海外 mode 也能像 TW 有「依職類別」分布表，不只是一堆無分類職缺 |
| **A5** | **TW 其他 gov 維度** | 主計總處「按教育程度別」「按性別」「按年齡組別」資料集 | 1 天/維度 | 擴 TW 自評維度（每個都是獨立 dataset，可選擇性接入） |

### B. UX / 工程優化

| ID | 項目 | 工程量 | 目的 |
|----|------|-------|------|
| **B1** | **FX 自動更新** | 0.5 天（daily cron + cache） | 解 `FX_TO_TWD` 雙端寫死的痛點。目前 USD=32 / GBP=40.5 / EUR=35 / AUD=21 / JPY=0.21；漂移 >10% 時要兩處同步手改，risky |
| **B2** | **「反向換算 / 跨國比較」UX 加強** | 0.5 天 | 已實作幣別切換；可在自評結果突顯「你 NT$X = USD$Y，要追上 US P50（USD$Z）還差 W%」，幫助考慮海外求職的使用者 |
| **B3** | **CompanyClassification 持續擴張** | on-going | 209 → 500+，依使用者實際在 Top 20 / 職缺流看到的雇主擴 |
| **B4** | **歐洲改多選 chip** | 1 天 | 替代固定六國 EU bucket，讓使用者自己挑「德 + 法 + 荷」這種組合 |

### C. 自評進階

| ID | 項目 | 工程量 | 目的 |
|----|------|-------|------|
| **C1** | **薪水 + 年資 + 履歷 + 證照 綜合評估** | 2-3 天（整合 A3 + A4） | 使用者輸入完整背景，系統給最精準 P 落點。是 A 系列做完後的合體 UX |
| **C2** | **薪資落點時間序列** | 1-2 天（DB year-snapshot + 折線圖） | 「我這個職位 5 年來薪資怎麼變」、「這個產業是不是在漲」 |
| **C3** | **薪資談判建議** | 1 天 | 給定使用者 P 值 + 目標 P，提供量化建議 / 談判話術 |

---

## 建議優先順序（如果要排 Phase 3 進度）

> 純建議，待產品決策拍板。

1. **A4 海外職類別分類**（1 天，高影響）— 目前海外 mode 只能給「全 AI 產業」的 P 值，加職類分類後可給「Software Engineer 的 P 值」，使用者真正關心的維度。
2. **A3 證照 / 作品分群**（1-2 天）— 直接 leverage 既有 `Resume.parsedData`，工程量低。
3. **B1 FX 自動更新**（0.5 天）— 純維運痛點，做完省事。
4. **C1 綜合評估**（要先做 A3 + A4） — 真正的「市場價值」UX 高潮。
5. **A1 TW 年資維度**（1-3 天）— 影響高但要研究 gov dataset 可行性，建議做完前 4 個再回來看。
6. **A2 JP/KR/CN**（2-3 天/國）— 投資報酬看市場需求；台灣使用者去日韓求職的比例需先評估。
7. **B2 / B3 / B4 / C2 / C3** — 看用戶回饋再排。

---

## 不在 Roadmap 內（明確排除）

- **爬蟲 Glassdoor / Levels.fyi / Blind**：法律風險高、爬蟲穩定性差，不接。
- **「政府資料 + Adzuna 自動混合」單一視圖**：兩個源的方法論差太多（員工實得 vs 雇主開價），混在一起會誤導；維持「TW = gov / 海外 = Adzuna」二分。
- **AI 預測薪資**：沒有足夠 ground-truth label，不做。
