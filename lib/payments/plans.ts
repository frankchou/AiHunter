import { LS_PRO_VARIANT_ID, LS_MAX_VARIANT_ID } from "./client";

export type PaidTier = "pro" | "max";

/** Given a tier, return the LemonSqueezy variant ID to use in checkout. */
export function variantIdForTier(tier: PaidTier): string | null {
  if (tier === "pro") return LS_PRO_VARIANT_ID;
  if (tier === "max") return LS_MAX_VARIANT_ID;
  return null;
}

/**
 * Reverse lookup: given a variant ID (from a webhook payload), return the
 * tier name we use in our DB. Returns null for unknown variants (defensive
 * — e.g., a webhook for a variant from a different product we don't track).
 */
export function tierForVariantId(variantId: string | number | null | undefined): PaidTier | null {
  if (variantId == null) return null;
  const id = String(variantId);
  if (id === LS_PRO_VARIANT_ID) return "pro";
  if (id === LS_MAX_VARIANT_ID) return "max";
  return null;
}
