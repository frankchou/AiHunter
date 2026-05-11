// Empirically determine Adzuna API limits before committing to an
// architecture. Tests:
//   1. results_per_page max (docs say 50 — verify)
//   2. Deep pagination — can we get page 50? page 100? page 200?
//   3. Rate limit on rapid sequential calls
//   4. What happens at the boundary (last page returns empty or 4xx?)
import axios from "axios";
import fs from "fs";

for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const APP_ID  = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
const url     = (country, page) => `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`;

async function call(country, page, opts) {
  const t0 = Date.now();
  const r = await axios.get(url(country, page), {
    params: { app_id: APP_ID, app_key: APP_KEY, ...opts },
    timeout: 15_000, validateStatus: () => true,
  });
  return { status: r.status, ms: Date.now() - t0, count: r.data?.count, returned: (r.data?.results ?? []).length, err: r.data?.exception };
}

// ─── Test 1: results_per_page max ────────────────────────────────────────
console.log("=== Test 1: results_per_page max ===");
for (const rpp of [10, 50, 100, 200, 500]) {
  const r = await call("us", 1, { results_per_page: rpp, what: "developer" });
  console.log(`  rpp=${rpp}  → status=${r.status} returned=${r.returned} count=${r.count}${r.err ? " err=" + r.err : ""}`);
}

// ─── Test 2: deep pagination ─────────────────────────────────────────────
console.log("\n=== Test 2: deep pagination (rpp=50) ===");
for (const page of [1, 10, 20, 50, 100, 200, 500]) {
  const r = await call("us", page, { results_per_page: 50, what: "developer" });
  console.log(`  page=${page}  → status=${r.status} returned=${r.returned}${r.err ? " err=" + r.err : ""}`);
}

// ─── Test 3: rapid sequential calls (probe for rate limit) ───────────────
console.log("\n=== Test 3: 20 rapid calls (rate limit probe) ===");
const t0 = Date.now();
const results = await Promise.all(
  Array.from({ length: 20 }, (_, i) =>
    call("us", (i % 5) + 1, { results_per_page: 1, what: "developer" })
  ),
);
const dur = Date.now() - t0;
const statusCounts = results.reduce((m, r) => { m[r.status] = (m[r.status] ?? 0) + 1; return m; }, {});
console.log(`  20 parallel calls completed in ${dur}ms`);
console.log(`  status breakdown:`, statusCounts);
console.log(`  any 429 (rate limit)? ${results.some((r) => r.status === 429)}`);

// ─── Test 4: page beyond last (find the boundary) ────────────────────────
console.log("\n=== Test 4: OpenAI what_phrase boundary ===");
const probe = await call("us", 1, { results_per_page: 1, what_phrase: "OpenAI" });
console.log(`  total count claimed: ${probe.count}  (≈ ${Math.ceil(probe.count / 50)} pages at rpp=50)`);
for (const page of [1, 50, 100, 178, 179, 180, 200]) {
  const r = await call("us", page, { results_per_page: 50, what_phrase: "OpenAI" });
  console.log(`  page=${page}  → status=${r.status} returned=${r.returned}${r.err ? " err=" + r.err : ""}`);
}
