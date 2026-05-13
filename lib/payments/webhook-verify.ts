import crypto from "crypto";

/**
 * Verify a LemonSqueezy webhook request signature.
 *
 * LemonSqueezy signs the raw request body with HMAC-SHA256 using the
 * `Signing secret` you set when creating the webhook. The hex digest is
 * sent in the `X-Signature` header. We re-compute the digest on our side
 * and compare in constant time.
 *
 * @param rawBody  Exact request body string (do NOT JSON.parse first — any
 *                 reformatting changes the bytes and breaks the HMAC).
 * @param signature Value of the `X-Signature` header.
 * @param secret    Same secret you set in the LemonSqueezy webhook dashboard
 *                  (must match exactly, no leading/trailing whitespace).
 */
export function verifyLemonWebhook(
  rawBody: string,
  signature: string | null | undefined,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");
  // timingSafeEqual throws if buffer lengths differ — guard explicitly.
  if (digest.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}
