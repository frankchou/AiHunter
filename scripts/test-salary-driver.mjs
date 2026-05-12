// Smoke-test the Twinkle driver end-to-end: fetch one snapshot, write
// to SalaryCache, read back, sanity-check the row shape.
import fs from "fs";
for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
process.env.PRISMA = prisma; // unused, just to silence unused warning if any

// Reuse the driver inline (we can't easily import the TS file from mjs).
const MCP_URL = process.env.TWINKLE_MCP_URL;
const API_KEY = process.env.TWINKLE_API_KEY;

let rpcId = 0;
async function callTool(name, args = {}) {
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
  });
  const ct = r.headers.get("content-type") || "";
  let parsed;
  if (ct.includes("event-stream")) {
    const raw = await r.text();
    const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
    parsed = JSON.parse(dataLine.slice(5).trim());
  } else {
    parsed = await r.json();
  }
  if (parsed.error) throw new Error(JSON.stringify(parsed.error));
  const first = parsed.result?.content?.[0];
  if (first?.type === "text") {
    try { return JSON.parse(first.text); } catch { return first.text; }
  }
  return parsed.result;
}

// Test 製造業 (41685) — biggest dataset, lots of rows
const datasetId = "41685";
console.log(`Fetching ${datasetId} via Twinkle...`);
const resp = await callTool("opendata-query_rows", { dataset_id: datasetId, limit: 500 });
console.log(`got ${resp.rows.length} raw rows; columns: ${resp.columns.length}`);

const idx = (name) => resp.columns.indexOf(name);
const annualIdx = resp.columns.findIndex((c) => c.includes("全年薪資所得"));
const latestYear = [...new Set(resp.rows.map((r) => String(r[idx("年度")])))].sort().pop();

const rows = resp.rows
  .filter((r) => String(r[idx("年度")]) === latestYear)
  .map((r) => ({
    occupation:   String(r[idx("職類別")] ?? ""),
    employees:    parseFloat(String(r[idx("7月底受僱員工人數")] ?? "0").replace(/,/g, "")) || 0,
    monthlyTwd:   parseFloat(String(r[idx("7月經常性薪資（金額元）")] ?? "0").replace(/,/g, "")) || 0,
    annualTwdWan: parseFloat(String(r[annualIdx] ?? "0").replace(/,/g, "")) || 0,
  }))
  .filter((row) => row.monthlyTwd > 0 || row.annualTwdWan > 0);

console.log(`\nYear ${latestYear} — ${rows.length} occupation rows after cleanup`);

// Sort by salary desc, show top 10
console.log("\nTop 10 by monthly salary:");
console.log("month/年薪萬/sample/職類");
rows.sort((a, b) => b.monthlyTwd - a.monthlyTwd).slice(0, 10).forEach((r) => {
  console.log(
    `  ${String(r.monthlyTwd).padStart(7)} / ${String(r.annualTwdWan).padStart(5)} / ${String(r.employees).padStart(7)} / ${r.occupation}`
  );
});

// Test the cache upsert
console.log("\nWriting to SalaryCache...");
await prisma.salaryCache.upsert({
  where: { datasetId_year: { datasetId, year: latestYear } },
  create: { datasetId, year: latestYear, data: rows },
  update: { data: rows, fetchedAt: new Date() },
});
const cached = await prisma.salaryCache.findFirst({ where: { datasetId } });
console.log(`Cache row: id=${cached.id}, year=${cached.year}, rows=${cached.data.length}`);

await prisma.$disconnect();
