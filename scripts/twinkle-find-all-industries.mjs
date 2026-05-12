// Round 3 — find ALL sibling datasets in the 勞動部「受僱員工人數、每人
// 薪資-XX業(按職類別分)」series. The first 4 we found (41697-41700) cover
// 教育/醫療/藝術/其他服務. We need to know which industries (我們的 37 個)
// have gov data coverage before designing the UI.

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

// Probe with various queries to discover the full sibling series.
const queries = [
  "受僱員工人數 每人薪資 按職類別",
  "受僱員工 薪資 製造業",
  "受僱員工 薪資 金融",
  "受僱員工 薪資 批發零售",
  "受僱員工 薪資 營造",
  "受僱員工 薪資 資訊通訊",
  "受僱員工 薪資 住宿餐飲",
  "受僱員工 薪資 運輸",
  "受僱員工 薪資 不動產",
  "受僱員工 薪資 礦業",
  "受僱員工 薪資 電力",
  "受僱員工 薪資 用水",
  "受僱員工 薪資 公共行政",
  "受僱員工 薪資 農林漁牧",
  "受僱員工 薪資 支援服務",
  "受僱員工 薪資 專業科學",
];

const seen = new Map();   // dataset_id -> {name, agency}
for (const q of queries) {
  try {
    const res = await callTool("opendata-search_datasets", { query: q, limit: 20 });
    for (const hit of res.hits ?? []) {
      const id = hit.dataset_id ?? hit.id;
      if (!id) continue;
      if (!seen.has(id)) seen.set(id, { name: hit.name, agency: hit.agency });
    }
  } catch (e) {
    console.log(`query "${q}" → error: ${e.message}`);
  }
}

// Filter to the "按職類別分" series specifically
const occBased = [...seen.entries()]
  .filter(([_, v]) => /按職類別分/.test(v.name))
  .sort(([a], [b]) => Number(a) - Number(b));

console.log(`\nFound ${occBased.length} "按職類別分" datasets:\n`);
for (const [id, v] of occBased) {
  console.log(`  ${id}  ${v.name}`);
}

console.log(`\n--- All ${seen.size} hits across queries (for context) ---`);
for (const [id, v] of [...seen.entries()].sort(([a], [b]) => Number(a) - Number(b))) {
  console.log(`  ${id}  [${v.agency}]  ${v.name}`);
}
