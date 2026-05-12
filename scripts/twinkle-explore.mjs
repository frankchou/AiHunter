// Twinkle Hub exploration — find which datasets cover Taiwan salary
// data, what columns they expose, and what filter dimensions we can
// realistically use in the /salary feature. Run with:
//   node scripts/twinkle-explore.mjs
//
// Doesn't touch any product code; pure read-only API probe.

import fs from "fs";

// Lightweight .env / .env.local loader so we don't need dotenv.
for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const URL_BASE = process.env.TWINKLE_MCP_URL;
const KEY      = process.env.TWINKLE_API_KEY;
if (!URL_BASE || !KEY) {
  console.error("Missing TWINKLE_MCP_URL or TWINKLE_API_KEY in .env / .env.local");
  process.exit(1);
}

// Minimal MCP / JSON-RPC 2.0 client. Twinkle's `tools/call` returns
// CallToolResult; the actual payload is a JSON string in content[0].text.
let rpcId = 0;
async function callTool(name, args = {}) {
  const body = {
    jsonrpc: "2.0",
    id: ++rpcId,
    method: "tools/call",
    params: { name, arguments: args },
  };
  const r = await fetch(URL_BASE, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status}: ${txt.slice(0, 500)}`);
  }
  const ct = r.headers.get("content-type") || "";

  // MCP may stream the response back as SSE (`text/event-stream`).
  // Handle both that and the plain JSON case.
  let parsed;
  if (ct.includes("event-stream")) {
    const raw = await r.text();
    const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) throw new Error(`SSE response had no data line:\n${raw.slice(0, 500)}`);
    parsed = JSON.parse(dataLine.slice(5).trim());
  } else {
    parsed = await r.json();
  }

  if (parsed.error) throw new Error(`RPC error: ${JSON.stringify(parsed.error)}`);
  const content = parsed.result?.content;
  if (!Array.isArray(content) || !content.length) {
    return parsed.result; // some tools may return non-text
  }
  // First content item is usually a JSON-string `text` payload.
  const first = content[0];
  if (first.type === "text" && typeof first.text === "string") {
    try { return JSON.parse(first.text); } catch { return first.text; }
  }
  return first;
}

function pretty(o) {
  return JSON.stringify(o, null, 2);
}

// ─── Run exploration ─────────────────────────────────────────────────────────
console.log("=".repeat(60));
console.log("1) opendata-list_domains");
console.log("=".repeat(60));
const domains = await callTool("opendata-list_domains");
console.log(pretty(domains));

console.log("\n" + "=".repeat(60));
console.log('2) opendata-search_datasets — query "薪資"');
console.log("=".repeat(60));
const salaryHits = await callTool("opendata-search_datasets", { query: "薪資", limit: 10 });
console.log(pretty(salaryHits));

console.log("\n" + "=".repeat(60));
console.log('3) opendata-search_datasets — query "職類別薪資"');
console.log("=".repeat(60));
const occHits = await callTool("opendata-search_datasets", { query: "職類別薪資", limit: 10 });
console.log(pretty(occHits));

console.log("\n" + "=".repeat(60));
console.log('4) opendata-search_datasets — query "行業 薪資 月薪"');
console.log("=".repeat(60));
const indHits = await callTool("opendata-search_datasets", { query: "行業 薪資 月薪", limit: 10 });
console.log(pretty(indHits));

// Dedupe dataset ids across the searches and inspect schema of each.
function extractIds(res) {
  if (!res) return [];
  // Twinkle wraps results under `hits`
  const arr = Array.isArray(res) ? res : (res.hits ?? res.items ?? res.datasets ?? []);
  return arr.map((it) => it.dataset_id ?? it.id).filter(Boolean);
}
const ids = Array.from(new Set([
  ...extractIds(salaryHits),
  ...extractIds(occHits),
  ...extractIds(indHits),
])).slice(0, 8);

console.log("\n" + "=".repeat(60));
console.log(`5) opendata-get_dataset schema for ${ids.length} datasets`);
console.log("=".repeat(60));
for (const id of ids) {
  console.log(`\n── ${id} ──`);
  try {
    const ds = await callTool("opendata-get_dataset", { dataset_id: id });
    // Trim noisy fields, show essentials.
    const summary = {
      dataset_id: ds.dataset_id ?? id,
      title: ds.title,
      license: ds.license,
      source_url: ds.source_url,
      columns: ds.columns ?? ds.schema?.columns ?? "(not present)",
      row_count: ds.row_count ?? ds.rows ?? "(unknown)",
      updated_at: ds.updated_at ?? ds.last_updated,
    };
    console.log(pretty(summary));
  } catch (e) {
    console.log(`  error: ${e.message}`);
  }
}

console.log("\n" + "=".repeat(60));
console.log("Done. Skim above and pick the dataset(s) we'll wire up.");
