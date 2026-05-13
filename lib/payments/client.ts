import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

// Lazy single-shot SDK init. Calling this before any LemonSqueezy
// API call is required (the SDK reads its API key from module-level
// state set by lemonSqueezySetup). Subsequent calls no-op.
let initialized = false;
export function initLemonSqueezy(): void {
  if (initialized) return;
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LEMONSQUEEZY_API_KEY not set. Add it to .env.local (dev) / Vercel env vars (prod)."
    );
  }
  lemonSqueezySetup({ apiKey });
  initialized = true;
}

export const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID ?? null;
export const LS_PRO_VARIANT_ID = process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? null;
export const LS_MAX_VARIANT_ID = process.env.LEMONSQUEEZY_MAX_VARIANT_ID ?? null;
export const LS_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? null;

// Single source of truth for "are we wired up to take payments via LemonSqueezy?"
// Used by API routes to gracefully refuse with 503 instead of throwing in
// environments where envs aren't filled in.
export const LEMON_ENABLED = !!(
  process.env.LEMONSQUEEZY_API_KEY &&
  LS_STORE_ID &&
  LS_PRO_VARIANT_ID &&
  LS_MAX_VARIANT_ID
);
