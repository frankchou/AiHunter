// Pull all distinct 職類別 values from 41685 (製造業, largest dataset)
// so we know what occupation buckets the gov data exposes.
import fs from "fs";
for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
const URL_BASE = process.env.TWINKLE_MCP_URL;
const KEY      = process.env.TWINKLE_API_KEY;
let rpcId = 0;
async function callTool(name, args = {}) {
  const r = await fetch(URL_BASE, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
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

// Pull all rows from 製造業 to enumerate occupations
const rows = await callTool("opendata-query_rows", { dataset_id: "41685", limit: 500 });
console.log(`Got ${rows.rows?.length ?? 0} rows`);
console.log(`columns: ${JSON.stringify(rows.columns)}`);

const occIdx = rows.columns.indexOf("職類別");
const yrIdx  = rows.columns.indexOf("年度");
const empIdx = rows.columns.indexOf("7月底受僱員工人數");

// Group by 年度 first to find latest year
const years = new Set(rows.rows.map((r) => r[yrIdx]));
console.log(`\nyears in dataset: ${[...years].sort()}`);

// Take the latest year's occupations
const latestYear = [...years].sort().pop();
const occ = rows.rows
  .filter((r) => r[yrIdx] === latestYear)
  .map((r) => ({ occ: r[occIdx], emp: r[empIdx] }))
  .sort((a, b) => Number(b.emp) - Number(a.emp));

console.log(`\n${latestYear} occupations in 製造業 (sorted by employees, desc):`);
for (const { occ: o, emp } of occ) {
  console.log(`  ${String(emp).padStart(8)}  ${o}`);
}
