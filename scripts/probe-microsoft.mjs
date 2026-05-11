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

for (const name of ["Microsoft", "Apple", "Palantir", "Hugging Face", "Microsoft Corporation"]) {
  try {
    const r = await axios.get("https://api.adzuna.com/v1/api/jobs/us/search/1", {
      params: { app_id: APP_ID, app_key: APP_KEY, results_per_page: 1, company: name },
      timeout: 10_000, validateStatus: () => true,
    });
    console.log(`"${name}" strict → status=${r.status} count=${r.data?.count} sample=${r.data?.results?.[0]?.company?.display_name ?? "(none)"}`);
  } catch (e) {
    console.log(`"${name}" strict → throw ${e.code || e.message}`);
  }
}
