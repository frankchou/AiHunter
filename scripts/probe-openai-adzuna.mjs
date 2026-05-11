// Empirically probe Adzuna for OpenAI — distinguish:
//  (a) raw what_phrase count (jobs mentioning "OpenAI" anywhere)
//  (b) jobs where company.display_name actually contains "OpenAI"
// Across multiple countries and pages.
import axios from "axios";
import fs from "fs";

// Load .env.local manually so we don't need dotenv as a dep
for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const APP_ID  = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
if (!APP_ID || !APP_KEY) {
  console.error("Missing ADZUNA_APP_ID / ADZUNA_APP_KEY in .env");
  process.exit(1);
}

const COUNTRIES = ["us", "gb", "de", "sg", "au", "ca"];
const NAME = "OpenAI";

function url(country, page) {
  return `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`;
}

console.log(`=== Probing Adzuna for "${NAME}" ===\n`);

for (const c of COUNTRIES) {
  // 1) strict company=
  let strictStatus = "?";
  let strictCount  = null;
  try {
    const r = await axios.get(url(c, 1), {
      params: { app_id: APP_ID, app_key: APP_KEY, results_per_page: 1, company: NAME },
      timeout: 12_000, validateStatus: () => true,
    });
    strictStatus = r.status;
    if (r.status === 200) strictCount = r.data.count;
  } catch (e) {
    strictStatus = "throw:" + (e.code || e.message);
  }

  // 2) what_phrase= raw count (just pull 1 result to read count)
  let phraseStatus = "?";
  let phraseCount  = null;
  try {
    const r = await axios.get(url(c, 1), {
      params: { app_id: APP_ID, app_key: APP_KEY, results_per_page: 1, what_phrase: NAME },
      timeout: 12_000, validateStatus: () => true,
    });
    phraseStatus = r.status;
    if (r.status === 200) phraseCount = r.data.count;
  } catch (e) {
    phraseStatus = "throw:" + (e.code || e.message);
  }

  // 3) what_phrase= pages 1-4 with 50/page, count display_name matches
  let displayMatches = 0;
  let displayMatchedNames = new Set();
  let pagesScanned = 0;
  for (let p = 1; p <= 4; p++) {
    try {
      const r = await axios.get(url(c, p), {
        params: { app_id: APP_ID, app_key: APP_KEY, results_per_page: 50, what_phrase: NAME, sort_by: "date" },
        timeout: 15_000, validateStatus: () => true,
      });
      if (r.status !== 200) break;
      pagesScanned++;
      const rows = r.data.results ?? [];
      for (const j of rows) {
        const dn = j.company?.display_name;
        if (dn && dn.toLowerCase().includes(NAME.toLowerCase())) {
          displayMatches++;
          displayMatchedNames.add(dn);
        }
      }
      if (rows.length < 50) break; // no more pages
    } catch { break; }
  }

  console.log(`[${c.toUpperCase()}]`);
  console.log(`  strict company=${NAME}     → status=${strictStatus} count=${strictCount}`);
  console.log(`  what_phrase=${NAME}        → status=${phraseStatus} count=${phraseCount}`);
  console.log(`  display_name contains "${NAME}" within first ${pagesScanned} pages × 50 = ${pagesScanned*50} samples: ${displayMatches} matches`);
  if (displayMatches > 0) console.log(`  distinct display_names found:`, [...displayMatchedNames]);
  console.log("");
}
