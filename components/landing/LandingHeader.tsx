import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// Sticky public-facing header shared by LandingPage / PlansPage / LoginPage.
//   `compact` — hide the "功能" anchor on pages that don't have a
//               #features section (so clicks don't go nowhere).
//   `hideAuth` — hide the top-right 登入 / 免費註冊 buttons. The login
//                page sets this because its center column already
//                surfaces the Google login button; duplicating the
//                CTAs in the header reads as noise.
interface Props {
  compact?: boolean;
  hideAuth?: boolean;
}
export function LandingHeader({ compact = false, hideAuth = false }: Props) {
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
        {!hideAuth && (
          <>
            <Link href="/login" className="landing-header-login">登入</Link>
            <Link href="/login" className="landing-header-cta">免費註冊</Link>
          </>
        )}
      </div>
    </header>
  );
}
