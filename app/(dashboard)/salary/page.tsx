import { SalaryView } from "@/components/salary/SalaryView";

export async function generateMetadata() {
  return { title: "薪資查詢 — AI Hunter" };
}

// 全 plan 免費、不過 billing gate。Layout requires login (inherited
// from (dashboard) — guests redirected to /login).
export default function SalaryPage() {
  return <SalaryView />;
}
