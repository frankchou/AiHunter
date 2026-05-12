import Link from "next/link";
import { PLANS, TICKET_COSTS } from "@/lib/plans";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import "./landing.css";

// Public-facing plans / pricing page. Server component, no auth required.
// CTA buttons all route through /login since signup is the funnel goal.
// Logged-in users can still visit; clicking a CTA will take them through
// /login which immediately redirects back into the app — harmless detour.
// The "real" upgrade UI (Stripe checkout, cancel modals, billing
// management) continues to live untouched in (dashboard)/pricing.

export function PlansPage() {
  return (
    <div className="landing">
      <LandingHeader />
      <Intro />
      <PlanCards />
      <FeatureCompare />
      <Faq />
      <BottomCTA />
      <LandingFooter />
    </div>
  );
}

// ─── Intro / page header ─────────────────────────────────────────────────────
function Intro() {
  return (
    <section style={{ padding: "72px 0 32px", background: "linear-gradient(to bottom, var(--brand-soft) 0%, var(--bg) 80%)" }}>
      <div className="landing-container" style={{ textAlign: "center" }}>
        <span className="landing-eyebrow">
          <span className="landing-dot" />
          方案說明
        </span>
        <h1 className="landing-h1" style={{ marginTop: 18, fontSize: "clamp(36px,5vw,56px)" }}>
          選一個方案，<span className="landing-highlight">開始你的 AI 求職</span>
        </h1>
        <p className="landing-hero-sub" style={{ margin: "22px auto 0", maxWidth: 580 }}>
          所有方案都能完整使用核心功能，差別在 AI 用量上限與旗艦級工具。
          隨時可升級、隨時可取消。
        </p>
      </div>
    </section>
  );
}

// ─── Plan cards ──────────────────────────────────────────────────────────────
function PlanCards() {
  return (
    <section style={{ padding: "32px 0 80px" }}>
      <div className="landing-container">
        <div style={{
          display: "grid", gap: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}>
          <PlanCard tier="free" />
          <PlanCard tier="pro" highlight />
          <PlanCard tier="max" />
        </div>
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          所有方案均支援信用卡付款 · 可隨時取消 · 不綁約
        </div>
      </div>
    </section>
  );
}

function PlanCard({ tier, highlight = false }: { tier: "free" | "pro" | "max"; highlight?: boolean }) {
  const plan = PLANS[tier];
  const isFree = tier === "free";
  const isMax  = tier === "max";

  // Tagline per tier — short summary above the feature list.
  const tagline =
    isFree ? "上手不用錢，先試了再說。" :
    isMax  ? "AI 全開，每一個求職場景都有專屬工具。" :
             "解除限制，每月 30 次 AI 評分、15 次履歷分析。";

  return (
    <div
      className="landing-card"
      style={{
        background: isMax ? "var(--ink)" : "var(--bg)",
        color:      isMax ? "var(--bg)"  : "var(--ink)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        // Highlight Pro: pull it up slightly + brand-color offset shadow
        transform: highlight ? "translateY(-6px)" : undefined,
        boxShadow: highlight ? "8px 8px 0 0 var(--brand)" : isMax ? "8px 8px 0 0 var(--brand)" : undefined,
      }}
    >
      {highlight && (
        <span className="landing-pill landing-pill-brand" style={{
          position: "absolute", top: -14, left: 22,
        }}>
          最多人選
        </span>
      )}

      <div>
        <div className="landing-card-num" style={{ color: isMax ? "var(--brand-accent)" : undefined }}>
          {plan.nameZh}
        </div>
        <div style={{
          marginTop: 10,
          fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1,
        }}>
          {plan.monthlyTwd === 0
            ? "免費"
            : <>NT$ {plan.monthlyTwd}<span style={{ fontSize: 16, fontWeight: 500, opacity: 0.6 }}> / 月</span></>}
        </div>
        <div style={{
          marginTop: 12, fontSize: 14, lineHeight: 1.55,
          color: isMax ? "#cbd5e1" : "var(--muted)",
        }}>
          {tagline}
        </div>
      </div>

      <ul style={{
        margin: 0, padding: 0, listStyle: "none",
        display: "flex", flexDirection: "column", gap: 10,
        borderTop: `1px solid ${isMax ? "rgba(255,255,255,.12)" : "var(--border)"}`,
        paddingTop: 18,
      }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{
            fontSize: 14, lineHeight: 1.55,
            paddingLeft: 24, position: "relative",
            color: isMax ? "#e5e7eb" : "var(--ink)",
          }}>
            <span style={{
              position: "absolute", left: 0, top: 2,
              color: isMax ? "var(--brand-accent)" : "var(--brand-deep)",
              fontWeight: 800,
            }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        {isFree ? (
          <Link href="/login" className="landing-btn-outline" style={{ display: "flex", justifyContent: "center" }}>
            免費註冊 →
          </Link>
        ) : (
          <Link
            href="/login"
            className="landing-btn-primary"
            style={{
              display: "flex", justifyContent: "center", width: "100%",
              background: isMax ? "var(--brand-accent)" : "var(--brand)",
              color: "var(--ink)",
            }}
          >
            選 {plan.nameZh} →
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Feature comparison ──────────────────────────────────────────────────────
function FeatureCompare() {
  // Hand-curated rows summarising the meaningful differences. Costs read
  // straight from TICKET_COSTS so they don't drift from the runtime.
  const rows: Array<{ feature: string; free: string; pro: string; max: string }> = [
    { feature: "履歷上傳與 AI 解析",   free: "每月 3 次",                       pro: "每月 15 次",                    max: "無限" },
    { feature: "職缺 AI 評分（洞察）", free: "每月 3 次",                       pro: "每月 30 次",                    max: "無限" },
    { feature: "求職信草稿",          free: "與履歷共用月度配額",              pro: "與履歷共用月度配額",            max: "無限" },
    { feature: "產業 Top 20 重新獲取", free: `每次 ${TICKET_COSTS.industryRefresh} 張券`, pro: "無限",                          max: "無限" },
    { feature: "Top 20 公司分數解鎖",  free: `每頁 ${TICKET_COSTS.companyScoring} 張券`,  pro: "每月每公司前 2 頁免費",         max: "無限解鎖、無限重算" },
    { feature: "針對性履歷 (B 履歷)",  free: "—",                              pro: "—",                            max: "✓" },
    { feature: "針對性求職信 (B CV)",  free: "—",                              pro: "—",                            max: "✓" },
    { feature: "AI 共創履歷助手",      free: "—",                              pro: "—",                            max: "✓" },
    { feature: "看廣告獲取解析券",     free: "每月最多 5 次",                   pro: "—",                            max: "—" },
  ];
  return (
    <section style={{ padding: "80px 0", background: "var(--surface)" }}>
      <div className="landing-container">
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span className="landing-label">完整比較</span>
          <h2 className="landing-h2" style={{ marginTop: 10 }}>三個方案的差別</h2>
        </div>
        <div style={{
          background: "var(--bg)",
          border: "2px solid var(--ink)",
          borderRadius: 18,
          boxShadow: "6px 6px 0 0 var(--brand)",
          overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--ink)", color: "var(--bg)" }}>
                <th style={cmpHeadCell}>功能</th>
                <th style={cmpHeadCell}>免費版</th>
                <th style={{ ...cmpHeadCell, color: "var(--brand-accent)" }}>專業版</th>
                <th style={cmpHeadCell}>旗艦版</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.feature} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <td style={cmpFeatCell}>{r.feature}</td>
                  <td style={cmpValCell}>{r.free}</td>
                  <td style={{ ...cmpValCell, color: "var(--brand-deep)", fontWeight: 700 }}>{r.pro}</td>
                  <td style={cmpValCell}>{r.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
const cmpHeadCell: React.CSSProperties = {
  textAlign: "left", padding: "14px 20px",
  fontSize: 13, fontWeight: 700, letterSpacing: "0.05em",
};
const cmpFeatCell: React.CSSProperties = {
  padding: "16px 20px", fontSize: 14, fontWeight: 600,
};
const cmpValCell: React.CSSProperties = {
  padding: "16px 20px", fontSize: 14, color: "var(--ink)",
};

// ─── FAQ ─────────────────────────────────────────────────────────────────────
function Faq() {
  const qa = [
    {
      q: "可以隨時取消嗎？",
      a: "可以。取消後當期結束前仍享有方案權益，下個月不再扣款。所有付款資料由 Stripe 處理。",
    },
    {
      q: "從 Pro 升 Max 會立即生效嗎？",
      a: "會。升級時 Stripe 會按比例計收本月差價、立即生效、下個月起以 Max 月費續扣。",
    },
    {
      q: "解析券是什麼？",
      a: "Free 用戶用來解鎖 AI 功能的單位。每月可看最多 5 次廣告獲取（每次 +1 張），或升級成 Pro / Max 解除大部分配額限制。",
    },
    {
      q: "我的履歷會被拿去訓練 AI 嗎？",
      a: "不會。履歷與分析結果只存在你的帳號下，僅用於為你產生評分與建議。完整資料政策請見隱私政策頁。",
    },
    {
      q: "支援台灣以外的職缺嗎？",
      a: "支援。職缺源涵蓋 20+ 國家（美 / 英 / 德 / 日 / 新加坡 / 澳洲等），可在偏好設定中選你關心的市場。",
    },
  ];
  return (
    <section style={{ padding: "80px 0" }}>
      <div className="landing-container" style={{ maxWidth: 720 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span className="landing-label">常見問題</span>
          <h2 className="landing-h2" style={{ marginTop: 10 }}>還有疑問？</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {qa.map((item) => (
            <details key={item.q} style={{
              background: "var(--bg)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "18px 22px",
            }}>
              <summary style={{
                cursor: "pointer", fontSize: 15, fontWeight: 700,
                color: "var(--ink)", listStyle: "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                {item.q}
                <span style={{ fontSize: 18, color: "var(--brand-deep)", marginLeft: 12 }}>+</span>
              </summary>
              <div style={{
                marginTop: 12, fontSize: 14, lineHeight: 1.7,
                color: "var(--muted)",
              }}>
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Bottom CTA ──────────────────────────────────────────────────────────────
function BottomCTA() {
  return (
    <section className="landing-final-cta">
      <div className="landing-container">
        <h2>還在猶豫？先免費上手</h2>
        <p>30 秒完成第一份履歷 AI 解析，隨時可升級。</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login" className="landing-btn-primary">免費註冊 →</Link>
          <Link href="/" className="landing-btn-outline" style={{ background: "transparent", color: "#fff", borderColor: "#fff" }}>
            看功能介紹
          </Link>
        </div>
        <div className="landing-hero-reassure" style={{ color: "#9ca3af" }}>
          完全免費上手 · 無需信用卡 · 隨時可升級
        </div>
      </div>
    </section>
  );
}
