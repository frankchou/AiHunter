// Round 2 — dig into the actual schema and a sample row for the
// dataset most likely to match our needs:
//   41697  受僱員工人數、每人薪資-教育業(按職類別分)
// If this one has the columns we need, the sibling 41698-41700 series
// will too (same shape, different industry).

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

const CANDIDATES = [
  { id: "41697", note: "薪資-教育業(按職類別分)" },
  { id: "41700", note: "薪資-其他服務業(按職類別分)" },
  { id: "9634",  note: "歷年受僱員工每人每月總薪資" },
  { id: "10903", note: "薪資及生產力統計" },
  { id: "6647",  note: "初任人員薪資" },
];

for (const { id, note } of CANDIDATES) {
  console.log("\n" + "=".repeat(70));
  console.log(`Dataset ${id} — ${note}`);
  console.log("=".repeat(70));

  // 1) Full get_dataset payload (no field stripping)
  try {
    const ds = await callTool("opendata-get_dataset", { dataset_id: id });
    console.log("--- full get_dataset response ---");
    console.log(JSON.stringify(ds, null, 2).slice(0, 4000));
  } catch (e) {
    console.log("get_dataset error:", e.message);
  }

  // 2) Try to pull 3 sample rows
  try {
    const rows = await callTool("opendata-query_rows", { dataset_id: id, limit: 3 });
    console.log("\n--- sample 3 rows ---");
    console.log(JSON.stringify(rows, null, 2).slice(0, 4000));
  } catch (e) {
    console.log("query_rows error:", e.message);
  }
}
