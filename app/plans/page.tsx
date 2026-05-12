import { PlansPage } from "@/components/landing/PlansPage";

export async function generateMetadata() {
  return { title: "方案 — AI Hunter" };
}

// Public-facing plans page. Not inside (dashboard) so no auth required.
// The existing dashboard /pricing route (with upgrade / downgrade /
// cancel flows) is untouched — that's the post-login management UX.
export default function Plans() {
  return <PlansPage />;
}
