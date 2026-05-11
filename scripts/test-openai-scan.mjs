// Directly invoke the new probeAndIngestCompanyJobs to verify what
// it returns for OpenAI without going through the full Next.js route.
import fs from "fs";
for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

// Use ts-loader trick by importing built .ts. Since this is dev,
// the easiest path is to dynamic import the source file. tsx isn't installed
// so we'll use a different tactic: replicate the logic inline below.
//
// But actually we have ts-node-like: Next builds dev cache. Let's try
// loading via a compatibility shim.
process.env.TS_NODE_PROJECT = "tsconfig.json";

const { probeAndIngestCompanyJobs, countriesForRegion } = await import(
  "../lib/job-sources/adzuna-company.ts"
).catch((e) => {
  console.error("Direct .ts import failed:", e.message);
  console.error("Will fall back to manual axios replication.");
  return {};
});

if (!probeAndIngestCompanyJobs) {
  console.log("Replicating logic inline (no ts-node)...");
  const axios = (await import("axios")).default;
  const APP_ID  = process.env.ADZUNA_APP_ID;
  const APP_KEY = process.env.ADZUNA_APP_KEY;
  const countries = ["us", "gb", "de", "sg", "au", "ca"];  // Global region
  const SAMPLE = 50, PAGES = 20;
  let totalMatched = 0;
  for (const c of countries) {
    let matched = 0;
    for (let p = 1; p <= PAGES; p++) {
      const r = await axios.get(`https://api.adzuna.com/v1/api/jobs/${c}/search/${p}`, {
        params: { app_id: APP_ID, app_key: APP_KEY, results_per_page: SAMPLE, sort_by: "date", what_phrase: "OpenAI" },
        timeout: 12_000, validateStatus: () => true,
      });
      if (r.status !== 200) { console.log(`  ${c} page ${p}: HTTP ${r.status} — stopping`); break; }
      const rows = r.data.results ?? [];
      for (const j of rows) {
        const dn = j.company?.display_name;
        if (dn && dn.toLowerCase().includes("openai")) matched++;
      }
      if (rows.length < SAMPLE) break;
    }
    console.log(`  ${c}: ${matched} matches`);
    totalMatched += matched;
  }
  console.log(`TOTAL OpenAI matches across all countries: ${totalMatched}`);
} else {
  const region = "Global";
  const countries = countriesForRegion(region);
  console.log("Calling probeAndIngestCompanyJobs('OpenAI', " + JSON.stringify(countries) + ") ...");
  const t0 = Date.now();
  const result = await probeAndIngestCompanyJobs("OpenAI", countries);
  console.log(`took ${Date.now() - t0}ms`);
  console.log(`count: ${result.count}, rows ingested: ${result.firstPageJobs.length}`);
  if (result.firstPageJobs.length) {
    console.log("sample row:", result.firstPageJobs[0]);
  }
}
