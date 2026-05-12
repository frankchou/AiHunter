"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Logo } from "@/components/ui/Logo";

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: string;
  maxOnly?: boolean;
}

interface NavItemWithFlags extends NavItem {
  hideForMax?: boolean;   // suppress for users already at the top tier
}

const NAV: NavItemWithFlags[] = [
  { id: "feed",     href: "/feed",     label: "職缺流",         icon: "⚡" },
  { id: "saved",    href: "/saved",    label: "我的收藏",       icon: "★" },
  { id: "resume",   href: "/resume",   label: "履歷",           icon: "📄" },
  { id: "resumes",  href: "/resumes",  label: "履歷版本",       icon: "📁", maxOnly: true },
  { id: "industry", href: "/industry", label: "產業 Top 20",    icon: "🏢" },
  { id: "salary",   href: "/salary",   label: "薪資查詢",       icon: "💰" },
  { id: "pricing",  href: "/pricing",  label: "升級方案",       icon: "🚀", hideForMax: true },
  { id: "settings", href: "/settings", label: "設定",           icon: "⚙" },
];

const profileFetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sideOpen, setSideOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const { data: session, status } = useSession();

  // Session expired in another tab / on the server. Send the browser
  // through /api/logout so cookies get the same definitive wipe as a
  // manual logout — never call NextAuth's signOut() directly, that
  // path doesn't clear chunked or OAuth-flow cookies.
  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/api/logout";
    }
  }, [status]);

  const pathname = usePathname();
  const { data: profile } = useSWR<{ planTier?: string; isSuperUser?: boolean }>(
    status === "authenticated" ? "/api/user/profile" : null,
    profileFetcher,
    { revalidateOnFocus: false }
  );
  const isMax = profile?.isSuperUser || profile?.planTier === "max";
  const visibleNav = NAV.filter((n) => {
    if (n.maxOnly && !isMax) return false;
    if (n.hideForMax && isMax) return false;
    return true;
  });

  const currentNav = visibleNav.find((n) => pathname.startsWith(n.href));
  const pageTitle = pathname.startsWith("/job/") ? "職缺詳情" : (currentNav?.label ?? "AI Hunter");

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`app-side${sideOpen ? " open" : ""}`}>
        <div className="brand">
          <Logo size={28} />
          <span>AI Hunter</span>
        </div>
        <nav className="side-nav">
          {visibleNav.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              className={pathname.startsWith(n.href) ? "active" : ""}
              onClick={() => setSideOpen(false)}
            >
              <span style={{ width: 18, textAlign: "center" }}>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        {session?.user && (
          <div style={{ fontSize: 11, color: "var(--ink-3)", padding: 10, borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="avatar">
                {session.user.image
                  ? <img src={session.user.image} alt="" />
                  : (session.user.name?.[0] ?? "U").toUpperCase()}
              </div>
              <div>
                <div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 12 }}>{session.user.name}</div>
                <div>{session.user.email}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="app-main">
        <div className="app-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="menu-toggle" onClick={() => setSideOpen((o) => !o)}>≡</button>
            <span className="title">{pageTitle}</span>
          </div>
          <div className="right" style={{ position: "relative" }}>
            <button
              onClick={() => setAccountMenu((o) => !o)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              title="帳號"
            >
              <div className="avatar">
                {session?.user?.image
                  ? <img src={session.user.image} alt="" />
                  : (session?.user?.name?.[0] ?? "U").toUpperCase()}
              </div>
            </button>
            {accountMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 8, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,.08)", zIndex: 50, overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{session?.user?.name}</div>
                  <div style={{ color: "var(--ink-3)" }}>{session?.user?.email}</div>
                </div>
                <Link href="/settings" onClick={() => setAccountMenu(false)}
                  style={{ display: "block", padding: "9px 12px", fontSize: 13, color: "var(--ink)" }}>
                  設定
                </Link>
                <button onClick={() => { setAccountMenu(false); window.location.href = "/api/logout"; }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", borderTop: "1px solid var(--line)", fontFamily: "inherit", fontSize: 13, cursor: "pointer", color: "var(--ink)" }}>
                  登出
                </button>
              </div>
            )}
          </div>
        </div>
        {children}
      </div>

      {/* Overlay for mobile sidebar */}
      {sideOpen && (
        <div
          onClick={() => setSideOpen(false)}
          style={{ position: "fixed", inset: "56px 0 0 0", background: "rgba(0,0,0,.3)", zIndex: 99 }}
        />
      )}
    </div>
  );
}
