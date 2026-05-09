"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const NAV = [
  { id: "feed",     href: "/feed",     label: "職缺流",         icon: "⚡" },
  { id: "saved",    href: "/saved",    label: "我的收藏",       icon: "★" },
  { id: "resume",   href: "/resume",   label: "履歷",           icon: "📄" },
  { id: "industry", href: "/industry", label: "產業 Top 100",   icon: "🏢" },
  { id: "pricing",  href: "/pricing",  label: "升級方案",       icon: "🚀" },
  { id: "settings", href: "/settings", label: "設定",           icon: "⚙" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sideOpen, setSideOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      signOut({ callbackUrl: "/login" });
    }
  }, [status]);
  const pathname = usePathname();

  const currentNav = NAV.find((n) => pathname.startsWith(n.href));
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
          {NAV.map((n) => (
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
                <button onClick={() => { setAccountMenu(false); signOut({ callbackUrl: "/login" }); }}
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
