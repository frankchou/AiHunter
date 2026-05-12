import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// Sticky public-facing header shared by LandingPage and PlansPage.
// "功能" anchor only resolves on the landing page itself; on /plans we
// suppress it (the section doesn't exist there) — controlled by `compact`.
export function LandingHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Link href="/" className="landing-logo">
          <Logo size={34} />
          AI Hunter
        </Link>
        <nav className="landing-nav">
          <Link href="/">首頁</Link>
          {!compact && <a href="#features">功能</a>}
          <Link href="/plans">方案</Link>
        </nav>
        <div style={{ flex: 1 }} />
        <Link href="/login" className="landing-header-login">登入</Link>
        <Link href="/login" className="landing-header-cta">免費註冊</Link>
      </div>
    </header>
  );
}
