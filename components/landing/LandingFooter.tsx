import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// Shared dark footer for LandingPage + PlansPage.
export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-grid">
          <div>
            <div className="landing-logo" style={{ color: "var(--bg)" }}>
              <Logo size={32} />
              AI Hunter
            </div>
            <p style={{ marginTop: 14, fontSize: 14, color: "#9ca3af", lineHeight: 1.65, maxWidth: 320 }}>
              讓 AI 幫你找到對的工作。<br />
              履歷、職缺、面試一條龍。
            </p>
          </div>
          <FooterCol title="產品" links={[
            { label: "首頁", href: "/" },
            { label: "功能", href: "/#features" },
            { label: "方案", href: "/plans" },
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
