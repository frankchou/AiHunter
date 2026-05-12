import Link from "next/link";
import { LogoMark } from "./LogoMark";
import { JobCard } from "@/components/jobs/JobCard";
import type { Job } from "@/lib/types";
import "./landing.css";

// Public marketing landing page. Visual language adapted from
// hub.twinkleai.tw — pure-white bg, near-black text, vivid brand color,
// neo-brutalist 2px borders with offset hard shadows. All copy is
// original Chinese.

export function LandingPage() {
  return (
    <div className="landing">
      <Header />
      <Hero />
      <NumbersStrip />
      <Problem />
      <Features />
      <Audiences />
      <FinalCTA />
      <SiteFooter />
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header() {
  return (
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Link href="/" className="landing-logo">
          <LogoMark size={34} />
          AI Hunter
        </Link>
        <nav className="landing-nav">
          <Link href="/">首頁</Link>
          <a href="#features">功能</a>
          <Link href="/pricing">方案</Link>
        </nav>
        <div style={{ flex: 1 }} />
        <Link href="/login" className="landing-header-login">登入</Link>
        <Link href="/login" className="landing-header-cta">免費註冊</Link>
      </div>
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="landing-hero">
      <div className="landing-container">
        <div className="landing-hero-grid">
          <div className="landing-hero-text">
            <div className="landing-rise landing-rise-1">
              <span className="landing-eyebrow">
                <span className="landing-dot" />
                AI 求職新體驗 · 2026
              </span>
            </div>
            <h1 className="landing-h1 landing-rise landing-rise-2">
              找下一份工作，<br />
              交給 <span className="landing-highlight">AI Hunter</span>。
            </h1>
            <p className="landing-hero-sub landing-rise landing-rise-3">
              上傳履歷，30 秒看到每個職缺的適配分數。<br />
              客製履歷、洞察 37 個產業頂尖雇主，全部一次到位。
            </p>
            <div className="landing-hero-ctas landing-rise landing-rise-4">
              <Link href="/login" className="landing-btn-primary">免費註冊 →</Link>
              <Link href="/pricing" className="landing-btn-outline">看方案</Link>
            </div>
            <div className="landing-hero-reassure landing-rise landing-rise-4">
              完全免費上手 · 無需信用卡 · 隨時可升級
            </div>
          </div>
          <div className="landing-rise landing-rise-3">
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// Renders the REAL <JobCard /> component (same one used in the live
// job feed) with mock data. Gives prospective users an honest preview
// of what they'll see after signup — same visual language, same
// score-pill styles, same tags. Wrapped in pointer-events:none so the
// buttons don't take the user out of the landing flow.
const HERO_MOCK_JOB: Job = {
  id: "demo-1",
  externalId: "demo",
  title: "Senior Software Engineer",
  company: "Google",
  ticker: "GOOGL",
  country: "TW",
  city: "Taipei",
  remote: "hybrid",
  type: "Full-time",
  salaryMin: 1_800_000,
  salaryMax: 2_400_000,
  ccy: "TWD",
  yearsMin: 5,
  yearsMax: 10,
  industry: "tech.consumer",
  skills: ["React", "Node.js", "TypeScript", "AWS", "Kubernetes"],
  description: "We're looking for an experienced engineer to join our Cloud Platform team in Taipei...",
  source: "adzuna",
  sourceUrl: "#",
  sourceHash: null,
  postedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),  // 3 hours ago
  crawledAt: new Date(),
  score: 0.92,
  matchReasons: [
    "履歷中的 React / Node 7 年經驗完全對應 JD 主要需求",
    "期望薪資落在職缺範圍內、無預期落差",
  ],
};

function HeroMockup() {
  return (
    <div style={{
      // Brutalist frame around the real card so the visual sits
      // confidently in the hero — matches the rest of the landing.
      border: "2px solid var(--ink)",
      borderRadius: 18,
      boxShadow: "8px 8px 0 0 var(--ink)",
      padding: 18,
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div className="landing-mockup-glow landing-mockup-glow-1" />
      <div className="landing-mockup-glow landing-mockup-glow-2" />
      <div style={{
        position: "absolute", top: 16, right: 16, zIndex: 2,
      }}>
        <span className="landing-pill landing-pill-soft">即時範例</span>
      </div>
      <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
        <JobCard
          job={HERO_MOCK_JOB}
          saved={false}
          onSave={() => { /* preview only */ }}
          reasonsLabel="AI 解析"
        />
      </div>
    </div>
  );
}

// ─── Numbers strip ───────────────────────────────────────────────────────────
function NumbersStrip() {
  const stats = [
    { value: "37", accent: true,  label: "個產業全覆蓋" },
    { value: "740+",                label: "頂尖雇主資料" },
    { value: "30秒",                label: "履歷 AI 解析" },
    { value: "20+",                 label: "國家職缺源" },
  ];
  return (
    <section>
      <div className="landing-container">
        <div className="landing-stats">
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div className={`landing-stat-value${s.accent ? " landing-stat-accent" : ""}`}>{s.value}</div>
              <div className="landing-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Problem ─────────────────────────────────────────────────────────────────
function Problem() {
  const pains = [
    { num: "01", title: "履歷投出去石沉大海", desc: "不知道哪裡不夠、要改什麼，被拒了也沒人告訴你原因。" },
    { num: "02", title: "求職資訊散落各平台", desc: "LinkedIn、104、Indeed、各家公司網站，要全部看完根本是另一份全職工作。" },
    { num: "03", title: "每份職缺都該客製履歷", desc: "理論上對，現實沒人有時間。一份履歷套到底，命中率自然低。" },
  ];
  return (
    <section className="landing-section landing-section-surface">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-label">為什麼存在這個產品</span>
          <h2 className="landing-h2">找工作不該這麼累</h2>
        </div>
        <div className="landing-grid-3">
          {pains.map((p) => (
            <div key={p.num} className="landing-card-flat">
              <div className="landing-card-num">{p.num}</div>
              <div className="landing-card-title">{p.title}</div>
              <div className="landing-card-desc">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      num: "01",
      title: "職缺流 AI 適配評分",
      desc: "聚合多個職缺平台，AI 以你的履歷為基準逐筆評分，附上推薦理由與不匹配警示。一眼看出哪個值得投。",
      pill: { label: "全方案", kind: "soft" as const },
    },
    {
      num: "02",
      title: "履歷 AI 深度解析",
      desc: "上傳一次，AI 拆解經歷、技能、薪資期待，給出具體改寫建議。版本管理保留每次迭代。",
      pill: { label: "全方案", kind: "soft" as const },
    },
    {
      num: "03",
      title: "產業 Top 20 雇主洞察",
      desc: "37 個產業、各 20 家頂尖雇主，AI 整理求職優缺點、未來趨勢、財報與職缺數量。一頁讀懂整個產業。",
      pill: { label: "全方案", kind: "soft" as const },
    },
    {
      num: "04",
      title: "針對性履歷與求職信",
      desc: "對任一職缺一鍵生成專屬版本，履歷亮點重組、求職信對應 JD 寫成，下載 PDF 直接投。",
      pill: { label: "Max 旗艦", kind: "ink" as const },
    },
  ];
  return (
    <section id="features" className="landing-section">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-label">四大功能</span>
          <h2 className="landing-h2">
            <span className="landing-highlight">一條龍</span> 打通求職流程
          </h2>
          <p>從履歷分析到客製化投遞，每一步都有 AI 幫你做最辛苦的部分。</p>
        </div>
        <div className="landing-grid-4">
          {features.map((f) => (
            <div key={f.num} className="landing-card" style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: 22, right: 22 }}>
                <span className={`landing-pill landing-pill-${f.pill.kind}`}>{f.pill.label}</span>
              </div>
              <div className="landing-card-num">{f.num}</div>
              <div className="landing-card-title">{f.title}</div>
              <div className="landing-card-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Audiences ───────────────────────────────────────────────────────────────
function Audiences() {
  const audiences = [
    {
      tag: "適合 · 新鮮人",
      title: "剛畢業，履歷沒方向",
      bullets: [
        "AI 履歷解析告訴你哪邊弱、怎麼補",
        "看 Top 20 釐清產業全貌",
        "免費 plan 完整體驗所有核心功能",
      ],
    },
    {
      tag: "適合 · 在職換工",
      title: "想換工作但沒時間整理",
      bullets: [
        "AI 評分自動過濾不適合的職缺",
        "針對性履歷與求職信一鍵生成",
        "AI 共創功能對話式優化履歷",
      ],
    },
    {
      tag: "適合 · 海外求職",
      title: "找海外工作資訊不足",
      bullets: [
        "20+ 國家職缺源整合",
        "Top 20 雇主含薪資與財報",
        "履歷與職缺薪資落差自動提醒",
      ],
    },
  ];
  return (
    <section className="landing-section landing-section-surface">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-label">適合誰用</span>
          <h2 className="landing-h2">不論你現在卡在哪</h2>
        </div>
        <div className="landing-grid-3">
          {audiences.map((a) => (
            <div key={a.title} className="landing-card-flat">
              <div className="landing-card-num">{a.tag}</div>
              <div className="landing-card-title">{a.title}</div>
              <ul style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {a.bullets.map((b) => (
                  <li
                    key={b}
                    style={{
                      fontSize: 14, color: "#374151", lineHeight: 1.65,
                      paddingLeft: 26, position: "relative",
                    }}
                  >
                    <span style={{
                      position: "absolute", left: 0, top: 1, color: "var(--brand-deep)",
                      fontWeight: 800, fontSize: 16,
                    }}>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="landing-final-cta">
      <div className="landing-container">
        <h2>準備好讓 AI 幫你找<br />下一份工作了嗎？</h2>
        <p>免費註冊，30 秒內完成第一份履歷 AI 解析。</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login" className="landing-btn-primary">免費註冊 →</Link>
          <Link href="/pricing" className="landing-btn-outline" style={{ background: "transparent", color: "#fff", borderColor: "#fff" }}>看方案</Link>
        </div>
        <div className="landing-hero-reassure" style={{ color: "#9ca3af" }}>
          完全免費上手 · 無需信用卡 · 隨時可升級
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function SiteFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-grid">
          <div>
            <div className="landing-logo" style={{ color: "var(--bg)" }}>
              <LogoMark size={32} />
              AI Hunter
            </div>
            <p style={{ marginTop: 14, fontSize: 14, color: "#9ca3af", lineHeight: 1.65, maxWidth: 320 }}>
              讓 AI 幫你找到對的工作。<br />
              履歷、職缺、面試一條龍。
            </p>
          </div>
          <FooterCol title="產品" links={[
            { label: "首頁", href: "/" },
            { label: "功能", href: "#features" },
            { label: "方案", href: "/pricing" },
          ]} />
          <FooterCol title="開始" links={[
            { label: "免費註冊", href: "/login" },
            { label: "登入", href: "/login" },
          ]} />
          <FooterCol title="法律" links={[
            { label: "服務條款", href: "/login" },
            { label: "隱私政策", href: "/login" },
          ]} />
        </div>
        <div className="landing-footer-bottom">
          <div>© 2026 AI Hunter</div>
          <div>讓 AI 接管你不想做的求職事務</div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
