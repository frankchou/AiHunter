import { LandingPage } from "@/components/landing/LandingPage";

// 首頁 = 公開 marketing landing。**永遠** render LandingPage、與登入
// 狀態徹底解耦。想進系統：點 LandingHeader 的「登入」走 /login → 按
// Google → OAuth → /feed。履歷檢查由 (dashboard)/layout.tsx 接手，
// 無履歷者會被導去 /onboarding。把 session 判斷放這裡會跟「首頁＝
// 廣告頁」的設計打架，也是「假登出後又被吸進系統」的放大器。
export default function Home() {
  return <LandingPage />;
}
