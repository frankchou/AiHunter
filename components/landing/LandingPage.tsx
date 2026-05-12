import Link from "next/link";

// Public-facing landing page. Server component — no client state needed,
// only static content + anchor scroll for in-page nav.
//
// Structure mirrors hub.twinkleai.tw's marketing flow at the section level,
// adapted to AI Hunter's product (resume / job-feed / Top 20 / tailored docs).
// Copy is original.

export function LandingPage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--ink)", minHeight: "100vh", fontFamily: "var(--font-sans)" }}>
      <Header />
      <Hero />
      <QuickFlow />
      <NumbersStrip />
      <DataSources />
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
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(247,246,242,.85)", backdropFilter: "blur(8px)",
      borderBottom: "1px solid var(--line)",
    }}>
      <div style={containerStyle({ paddingY: 14, display: "flex", alignItems: "center", gap: 24 })}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8, background: "var(--ink)", color: "var(--bg)",
            display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
          }}>AI</span>
          AI Hunter
        </Link>
        <nav style={{ display: "flex", gap: 18, marginLeft: 24, fontSize: 13, color: "var(--ink-2)" }}>
          <Link href="/" style={navLinkStyle}>首頁</Link>
          <a href="#features" style={navLinkStyle}>功能</a>
          <Link href="/pricing" style={navLinkStyle}>方案</Link>
        </nav>
        <div style={{ flex: 1 }} />
        <Link href="/login" style={{ ...navLinkStyle, fontSize: 13 }}>登入</Link>
        <Link
          href="/login"
          style={{
            padding: "8px 16px", borderRadius: 8, background: "var(--ink)", color: "var(--bg)",
            fontSize: 13, fontWeight: 600,
          }}
        >
          免費註冊 →
        </Link>
      </div>
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ padding: "80px 0 60px" }}>
      <div style={containerStyle({ textAlign: "center" })}>
        <div style={{
          display: "inline-block", padding: "6px 14px", borderRadius: 999,
          background: "var(--accent-soft)", color: "var(--accent-ink)",
          fontSize: 12, fontWeight: 600, letterSpacing: ".05em", marginBottom: 24,
        }}>
          AI-POWERED JOB SEARCH · 2026
        </div>
        <h1 style={{
          fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1.1, letterSpacing: "-.02em",
          fontWeight: 800, margin: "0 0 20px",
        }}>
          履歷 → 職缺 → 面試<br />
          <span style={{ color: "var(--accent-ink)" }}>AI 一條龍幫你找工作</span>
        </h1>
        <p style={{
          fontSize: 17, color: "var(--ink-2)", maxWidth: 640, margin: "0 auto 36px", lineHeight: 1.6,
        }}>
          上傳履歷，30 秒看到每個職缺的適配分數。<br />
          一鍵客製專屬版本，洞察 37 個產業 Top 20 雇主，全部交給 AI Hunter。
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              padding: "14px 28px", borderRadius: 10, background: "var(--ink)", color: "var(--bg)",
              fontSize: 15, fontWeight: 600,
            }}
          >
            免費註冊 / Get Started →
          </Link>
          <Link
            href="/pricing"
            style={{
              padding: "14px 28px", borderRadius: 10, background: "transparent", color: "var(--ink)",
              border: "1px solid var(--ink)", fontSize: 15, fontWeight: 600,
            }}
          >
            看方案 / View Plans
          </Link>
        </div>
        <div style={{ marginTop: 18, fontSize: 12, color: "var(--ink-3)" }}>
          完全免費上手 · 無需信用卡 · No credit card required
        </div>
      </div>
    </section>
  );
}

// ─── Quick flow (3 steps) ────────────────────────────────────────────────────
function QuickFlow() {
  const steps = [
    { num: "01", icon: "📄", titleZh: "上傳履歷", titleEn: "Upload Resume", desc: "PDF 或 Word 都行。AI 自動解析學經歷、技能、薪資期待。" },
    { num: "02", icon: "⚡", titleZh: "30 秒解析", titleEn: "AI Analysis", desc: "履歷打分、優劣勢診斷、強化建議，立刻拿到面試前的最後一道把關。" },
    { num: "03", icon: "🎯", titleZh: "看適配排名", titleEn: "Match & Apply", desc: "全球職缺 AI 評分排序、Top 20 雇主分析、客製履歷與求職信一鍵生成。" },
  ];
  return (
    <section style={{ padding: "40px 0 80px", background: "var(--bg-elev)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div style={containerStyle()}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          {steps.map((s) => (
            <div key={s.num} style={{ padding: 28 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-4)", letterSpacing: ".1em", marginBottom: 8 }}>{s.num}</div>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{s.titleZh}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10, letterSpacing: ".02em" }}>{s.titleEn}</div>
              <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Numbers strip ───────────────────────────────────────────────────────────
function NumbersStrip() {
  const stats = [
    { value: "37", unit: "Industries", label: "個產業全覆蓋" },
    { value: "740+", unit: "Top Employers", label: "頂尖雇主資料" },
    { value: "30s", unit: "Resume AI", label: "履歷解析時間" },
    { value: "20+", unit: "Countries", label: "國家職缺源" },
  ];
  return (
    <section style={{ padding: "60px 0" }}>
      <div style={containerStyle()}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: "center", padding: "20px 8px" }}>
              <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-.02em", color: "var(--ink)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)", letterSpacing: ".1em", marginTop: 6, textTransform: "uppercase" }}>{s.unit}</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Data sources (compatibility row) ────────────────────────────────────────
function DataSources() {
  const sources = ["Adzuna", "Remotive", "JSearch", "Yahoo Finance", "Anthropic Claude"];
  return (
    <section style={{ padding: "30px 0 60px" }}>
      <div style={containerStyle()}>
        <div style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 16 }}>
          Powered by · 整合資料源
        </div>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 24, opacity: .7 }}>
          {sources.map((s) => (
            <div key={s} style={{
              padding: "10px 18px", border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: "var(--ink-2)",
            }}>
              {s}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Problem statement ───────────────────────────────────────────────────────
function Problem() {
  const pains = [
    { emoji: "📨", title: "履歷投出去石沉大海", desc: "不知道自己跟職缺差在哪、要改什麼，被拒了也沒回饋。" },
    { emoji: "🔍", title: "求職資訊散落各平台", desc: "LinkedIn、104、Indeed、各家公司網站，要看完根本是一份全職工作。" },
    { emoji: "✍️", title: "每份職缺都該客製履歷", desc: "理論上對，現實沒人有時間。一份履歷套到底，命中率自然低。" },
  ];
  return (
    <section style={{ padding: "80px 0", background: "var(--bg-soft)" }}>
      <div style={containerStyle()}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)", letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 10 }}>The Problem</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.01em", margin: 0 }}>找工作為什麼這麼累？</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {pains.map((p) => (
            <div key={p.title} style={{
              background: "var(--bg-elev)", padding: 28, borderRadius: 12,
              border: "1px solid var(--line)",
            }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{p.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{p.title}</div>
              <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Feature cards (4 numbered, the four pillars) ────────────────────────────
function Features() {
  const features = [
    {
      num: "01",
      titleZh: "職缺流 + AI 適配評分",
      titleEn: "Smart Job Feed",
      desc: "聚合 Adzuna / Remotive / JSearch 多平台職缺，AI 以你的履歷為基準給每個職缺打分數，附上推薦理由與不匹配警示。",
      badge: "All Plans",
    },
    {
      num: "02",
      titleZh: "履歷 AI 深度解析",
      titleEn: "Resume Deep Analysis",
      desc: "上傳一次，AI 拆解經歷、技能、薪資期待，給出具體改寫建議。版本管理保留每次迭代。",
      badge: "All Plans",
    },
    {
      num: "03",
      titleZh: "產業 Top 20 雇主洞察",
      titleEn: "Industry Top 20",
      desc: "37 個產業 × 各 20 家頂尖雇主，AI 整理求職優缺點、未來趨勢、最新財報與職缺數量。一頁看懂整個產業。",
      badge: "All Plans",
    },
    {
      num: "04",
      titleZh: "針對性履歷 / 求職信",
      titleEn: "Tailored Resume & CV",
      desc: "對任一職缺一鍵生成專屬版本：履歷亮點重組、求職信對應 JD 寫成，下載 PDF 直接投。",
      badge: "Max Exclusive",
    },
  ];
  return (
    <section id="features" style={{ padding: "100px 0" }}>
      <div style={containerStyle()}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)", letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 10 }}>Four Pillars</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.01em", margin: 0 }}>四大功能，一條龍打通求職流程</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {features.map((f) => (
            <div key={f.num} style={{
              padding: 32, borderRadius: 12, background: "var(--bg-elev)",
              border: "1px solid var(--line)", position: "relative",
            }}>
              <div style={{
                position: "absolute", top: 20, right: 20, fontSize: 10,
                padding: "3px 8px", borderRadius: 4, fontWeight: 600,
                background: f.badge === "Max Exclusive" ? "var(--ink)" : "var(--accent-soft)",
                color: f.badge === "Max Exclusive" ? "var(--bg)" : "var(--accent-ink)",
                letterSpacing: ".05em",
              }}>{f.badge}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-4)", letterSpacing: ".1em", marginBottom: 16 }}>{f.num}</div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{f.titleZh}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", letterSpacing: ".02em", marginBottom: 14 }}>{f.titleEn}</div>
              <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Audiences (3 paths) ─────────────────────────────────────────────────────
function Audiences() {
  const audiences = [
    {
      tag: "FOR · 新鮮人",
      title: "剛畢業，履歷沒方向",
      bullets: [
        "AI 履歷解析告訴你哪邊弱、怎麼補",
        "看 Top 20 公司釐清產業地圖",
        "免費 plan 完整體驗所有核心功能",
      ],
    },
    {
      tag: "FOR · 在職換工",
      title: "想換工作，但沒時間",
      bullets: [
        "AI 評分自動過濾不適合的職缺",
        "針對性履歷 / CV 一鍵生成（Max）",
        "AI 共創功能對話式優化履歷（Max）",
      ],
    },
    {
      tag: "FOR · 海外求職",
      title: "找海外工作，資訊不足",
      bullets: [
        "20+ 國家職缺整合 (US/UK/JP/SG…)",
        "Top 20 雇主含薪資、文化、財報",
        "薪資與履歷期望落差 AI 提醒",
      ],
    },
  ];
  return (
    <section style={{ padding: "80px 0", background: "var(--bg-soft)" }}>
      <div style={containerStyle()}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)", letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 10 }}>Who It&apos;s For</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.01em", margin: 0 }}>不論你現在在哪一階段</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {audiences.map((a) => (
            <div key={a.title} style={{
              background: "var(--bg-elev)", padding: 28, borderRadius: 12,
              border: "1px solid var(--line)",
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-ink)", letterSpacing: ".1em", marginBottom: 14 }}>{a.tag}</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>{a.title}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {a.bullets.map((b) => (
                  <li key={b} style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6, paddingLeft: 22, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, top: 0, color: "var(--accent-ink)", fontWeight: 700 }}>✓</span>
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

// ─── Final CTA band ──────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section style={{ padding: "100px 0" }}>
      <div style={containerStyle({ textAlign: "center" })}>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-.01em", margin: "0 0 16px" }}>
          準備好讓 AI 幫你找下一份工作？
        </h2>
        <p style={{ fontSize: 16, color: "var(--ink-2)", marginBottom: 32 }}>
          Ready to upgrade your job search?
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              padding: "16px 36px", borderRadius: 10, background: "var(--ink)", color: "var(--bg)",
              fontSize: 16, fontWeight: 600,
            }}
          >
            免費註冊 / Get Started →
          </Link>
          <Link
            href="/pricing"
            style={{
              padding: "16px 36px", borderRadius: 10, background: "transparent", color: "var(--ink)",
              border: "1px solid var(--ink)", fontSize: 16, fontWeight: 600,
            }}
          >
            看方案 / View Plans
          </Link>
        </div>
        <div style={{ marginTop: 18, fontSize: 12, color: "var(--ink-3)" }}>
          完全免費上手 · 無需信用卡 · 隨時可升級
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "40px 0 30px", background: "var(--bg-elev)" }}>
      <div style={containerStyle()}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 6, background: "var(--ink)", color: "var(--bg)",
                display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
              }}>AI</span>
              AI Hunter
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.6, maxWidth: 320 }}>
              讓 AI 幫你找到對的工作。<br />
              An AI-powered job search assistant.
            </p>
          </div>
          <FooterCol title="產品 / Product" links={[
            { label: "首頁", href: "/" },
            { label: "功能", href: "#features" },
            { label: "方案", href: "/pricing" },
          ]} />
          <FooterCol title="開始使用 / Get Started" links={[
            { label: "免費註冊", href: "/login" },
            { label: "登入", href: "/login" },
          ]} />
          <FooterCol title="法律 / Legal" links={[
            { label: "服務條款", href: "/login" },
            { label: "隱私政策", href: "/login" },
          ]} />
        </div>
        <div style={{ paddingTop: 20, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--ink-4)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>© 2026 AI Hunter. All rights reserved.</div>
          <div>Made with AI, for job seekers.</div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} style={{ fontSize: 13, color: "var(--ink-2)" }}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── shared layout helpers ───────────────────────────────────────────────────
function containerStyle(extra: React.CSSProperties & { paddingY?: number } = {}): React.CSSProperties {
  const { paddingY, ...rest } = extra;
  return {
    maxWidth: 1120,
    margin: "0 auto",
    padding: `${paddingY ?? 0}px 24px`,
    ...rest,
  };
}

const navLinkStyle: React.CSSProperties = {
  color: "var(--ink-2)",
  fontSize: 13,
  fontWeight: 500,
};
