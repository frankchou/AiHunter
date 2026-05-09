import crypto from "crypto";
import type { Job } from "@/lib/types";

export function fmtSalary(job: Pick<Job, "salaryMin" | "salaryMax" | "ccy">): string {
  if (!job.salaryMin) return "薪資未公開";
  const f = (n: number) =>
    n >= 1_000_000 ? (n / 10_000).toFixed(0) + "萬" : n.toLocaleString();
  if (job.ccy === "TWD") return `${f(job.salaryMin)}–${f(job.salaryMax ?? 0)} TWD`;
  if (job.ccy === "JPY")
    return `¥${(job.salaryMin / 10_000).toFixed(0)}–${((job.salaryMax ?? 0) / 10_000).toFixed(0)} 萬`;
  return `${job.ccy} ${(job.salaryMin / 1_000).toFixed(0)}k–${((job.salaryMax ?? 0) / 1_000).toFixed(0)}k`;
}

export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export function relativeTime(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "剛才";
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 個月前`;
}

export function buildQueryString(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) v.forEach((item) => q.append(k, String(item)));
    else q.set(k, String(v));
  }
  return q.toString();
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Compact money formatter for financial values: $24.3B / NT$ 580M / ¥1.2T.
// `value` is in the natural unit of the currency (USD dollars, JPY yen, …).
export function fmtCompactMoney(value: number | null | undefined, currency: string | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  const sign  = value < 0 ? "-" : "";
  const abs   = Math.abs(value);
  const sym   =
    currency === "USD" ? "$" :
    currency === "TWD" ? "NT$" :
    currency === "JPY" ? "¥" :
    currency === "KRW" ? "₩" :
    currency === "HKD" ? "HK$" :
    currency === "EUR" ? "€" :
    currency === "GBP" ? "£" :
    currency === "CNY" ? "¥" :
    currency ? `${currency} ` : "";

  let unit = "";
  let num  = abs;
  if      (abs >= 1e12) { num = abs / 1e12; unit = "T"; }
  else if (abs >= 1e9)  { num = abs / 1e9;  unit = "B"; }
  else if (abs >= 1e6)  { num = abs / 1e6;  unit = "M"; }
  else if (abs >= 1e3)  { num = abs / 1e3;  unit = "K"; }

  const rounded = num >= 100 ? num.toFixed(0) : num.toFixed(1);
  return `${sign}${sym}${rounded}${unit}`;
}

// "+12.3%" / "−4.1%" / "—"
export function fmtPct(p: number | null | undefined): string {
  if (p == null || isNaN(p)) return "—";
  const s = p > 0 ? "+" : p < 0 ? "−" : "";
  return `${s}${Math.abs(p).toFixed(1)}%`;
}
