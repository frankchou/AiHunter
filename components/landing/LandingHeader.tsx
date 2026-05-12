import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// Sticky public-facing header shared by LandingPage / PlansPage / LoginPage.
//   `hideAuth` — hide the top-right 登入 / 免費註冊 buttons. The login
//                page sets this because its center column already
//                surfaces the Google login button; duplicating the
//                CTAs in the header reads as noise.
//
// "功能" link uses a path+hash (/#features) so it works from any page —
// clicking from /plans or /login routes back to landing and scrolls
// straight to the features section.
interface Props {
  hideAuth?: boolean;
}
export function LandingHeader({ hideAuth = false }: Props) {
  return (
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Link href="/" className="landing-logo">
          <Logo size={34} />
          AI Hunter
        </Link>
        <nav className="landing-nav">
          <Link href="/">首頁</Link>
          <Link href="/#features">功能</Link>
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
