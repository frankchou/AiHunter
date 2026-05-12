import { LoginPage } from "@/components/auth/LoginPage";

// /login **永遠** render LoginPage，不做「已登入就自動跳 /feed」的
// 貼心判斷。那段判斷會把「cookie 沒清乾淨的假登出」放大成「按登入
// 瞬間被吸進系統」，動線不可預測。設計上 /login = 純登入入口，是否
// 已登入交給 Google OAuth 那步來決定（LoginPage 的 Google 按鈕會在
// signIn 前先強制清一次 NextAuth cookie，徹底斷掉殘留 session）。
export default function Login() {
  return <LoginPage />;
}
