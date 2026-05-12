// One-shot seed for the CompanyClassification table. Idempotent — uses
// upsert so re-running the script just refreshes the rows. Maintain
// this list as new well-known employers get tagged in Adzuna data.
//
// Naming convention: `companyName` should match Adzuna's display_name
// as closely as possible (case-insensitive contains match). For
// employers Adzuna doesn't index by strict company= (like OpenAI), the
// what_phrase fallback in adzuna-company.ts already lands on the same
// display_name, so a single canonical entry per employer suffices.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ─── The list. ~150 employers across the 6 buckets. ──────────────────────────
//   foreign_tier1: FAANG-tier + chip giants + frontier AI
//   foreign_traditional: legacy enterprise / Big-4 consulting / CPG
//   tw_local: TW-headquartered (any size; user wanted these as a single bucket)
//   large_enterprise: > 2000-employee non-TW non-foreign-tier1/traditional
//   sme: smaller (50-2000)
//   startup: < 50 or < 5 years old
const SEED = [
  // ─── Tier-1 外商 ────────────────────────────────────────────────────────
  ["Google", "foreign_tier1", "US"],
  ["Alphabet", "foreign_tier1", "US"],
  ["Meta", "foreign_tier1", "US"],
  ["Facebook", "foreign_tier1", "US"],
  ["Apple", "foreign_tier1", "US"],
  ["Microsoft", "foreign_tier1", "US"],
  ["Amazon", "foreign_tier1", "US"],
  ["Amazon Web Services", "foreign_tier1", "US"],
  ["AWS", "foreign_tier1", "US"],
  ["Netflix", "foreign_tier1", "US"],
  ["NVIDIA", "foreign_tier1", "US"],
  ["Nvidia", "foreign_tier1", "US"],
  ["OpenAI", "foreign_tier1", "US"],
  ["Anthropic", "foreign_tier1", "US"],
  ["Mistral", "foreign_tier1", "FR"],
  ["DeepMind", "foreign_tier1", "UK"],
  ["Stripe", "foreign_tier1", "US"],
  ["Databricks", "foreign_tier1", "US"],
  ["Snowflake", "foreign_tier1", "US"],
  ["Salesforce", "foreign_tier1", "US"],
  ["Tesla", "foreign_tier1", "US"],
  ["SpaceX", "foreign_tier1", "US"],
  ["LinkedIn", "foreign_tier1", "US"],
  ["GitHub", "foreign_tier1", "US"],
  ["ASML", "foreign_tier1", "NL"],
  ["AMD", "foreign_tier1", "US"],
  ["Qualcomm", "foreign_tier1", "US"],
  ["Broadcom", "foreign_tier1", "US"],
  ["Lam Research", "foreign_tier1", "US"],
  ["Micron", "foreign_tier1", "US"],
  ["Applied Materials", "foreign_tier1", "US"],
  ["Adobe", "foreign_tier1", "US"],

  // ─── 傳統外商 ───────────────────────────────────────────────────────────
  ["IBM", "foreign_traditional", "US"],
  ["Oracle", "foreign_traditional", "US"],
  ["SAP", "foreign_traditional", "DE"],
  ["Cisco", "foreign_traditional", "US"],
  ["Intel", "foreign_traditional", "US"],
  ["HP", "foreign_traditional", "US"],
  ["HPE", "foreign_traditional", "US"],
  ["Dell", "foreign_traditional", "US"],
  ["Accenture", "foreign_traditional", "US"],
  ["EY", "foreign_traditional", "US"],
  ["Ernst & Young", "foreign_traditional", "US"],
  ["Deloitte", "foreign_traditional", "US"],
  ["KPMG", "foreign_traditional", "US"],
  ["PwC", "foreign_traditional", "US"],
  ["PricewaterhouseCoopers", "foreign_traditional", "US"],
  ["McKinsey", "foreign_traditional", "US"],
  ["McKinsey & Company", "foreign_traditional", "US"],
  ["BCG", "foreign_traditional", "US"],
  ["Boston Consulting Group", "foreign_traditional", "US"],
  ["Bain", "foreign_traditional", "US"],
  ["Bain & Company", "foreign_traditional", "US"],
  ["Unilever", "foreign_traditional", "UK"],
  ["P&G", "foreign_traditional", "US"],
  ["Procter & Gamble", "foreign_traditional", "US"],
  ["Coca-Cola", "foreign_traditional", "US"],
  ["PepsiCo", "foreign_traditional", "US"],
  ["Nestle", "foreign_traditional", "CH"],
  ["Nestlé", "foreign_traditional", "CH"],
  ["Pfizer", "foreign_traditional", "US"],
  ["Roche", "foreign_traditional", "CH"],
  ["Johnson & Johnson", "foreign_traditional", "US"],
  ["GSK", "foreign_traditional", "UK"],
  ["GlaxoSmithKline", "foreign_traditional", "UK"],
  ["Novartis", "foreign_traditional", "CH"],
  ["Citigroup", "foreign_traditional", "US"],
  ["Citi", "foreign_traditional", "US"],
  ["JPMorgan", "foreign_traditional", "US"],
  ["JPMorgan Chase", "foreign_traditional", "US"],
  ["Goldman Sachs", "foreign_traditional", "US"],
  ["Morgan Stanley", "foreign_traditional", "US"],
  ["HSBC", "foreign_traditional", "UK"],
  ["Standard Chartered", "foreign_traditional", "UK"],
  ["BMW", "foreign_traditional", "DE"],
  ["Mercedes-Benz", "foreign_traditional", "DE"],
  ["Volkswagen", "foreign_traditional", "DE"],
  ["Siemens", "foreign_traditional", "DE"],

  // ─── 台商 ───────────────────────────────────────────────────────────────
  ["TSMC", "tw_local", "TW"],
  ["台積電", "tw_local", "TW"],
  ["Taiwan Semiconductor Manufacturing Company", "tw_local", "TW"],
  ["Foxconn", "tw_local", "TW"],
  ["鴻海", "tw_local", "TW"],
  ["Hon Hai Precision Industry", "tw_local", "TW"],
  ["MediaTek", "tw_local", "TW"],
  ["聯發科", "tw_local", "TW"],
  ["Quanta Computer", "tw_local", "TW"],
  ["廣達", "tw_local", "TW"],
  ["Compal", "tw_local", "TW"],
  ["仁寶", "tw_local", "TW"],
  ["Pegatron", "tw_local", "TW"],
  ["和碩", "tw_local", "TW"],
  ["Wistron", "tw_local", "TW"],
  ["緯創", "tw_local", "TW"],
  ["AU Optronics", "tw_local", "TW"],
  ["友達光電", "tw_local", "TW"],
  ["Innolux", "tw_local", "TW"],
  ["群創光電", "tw_local", "TW"],
  ["UMC", "tw_local", "TW"],
  ["聯電", "tw_local", "TW"],
  ["United Microelectronics", "tw_local", "TW"],
  ["Realtek", "tw_local", "TW"],
  ["瑞昱", "tw_local", "TW"],
  ["Novatek", "tw_local", "TW"],
  ["聯詠", "tw_local", "TW"],
  ["ASE", "tw_local", "TW"],
  ["日月光", "tw_local", "TW"],
  ["Chunghwa Telecom", "tw_local", "TW"],
  ["中華電信", "tw_local", "TW"],
  ["Far EasTone", "tw_local", "TW"],
  ["遠傳電信", "tw_local", "TW"],
  ["Taiwan Mobile", "tw_local", "TW"],
  ["台灣大哥大", "tw_local", "TW"],
  ["Cathay Financial", "tw_local", "TW"],
  ["國泰金控", "tw_local", "TW"],
  ["Fubon Financial", "tw_local", "TW"],
  ["富邦金控", "tw_local", "TW"],
  ["E.SUN Bank", "tw_local", "TW"],
  ["玉山銀行", "tw_local", "TW"],
  ["CTBC Bank", "tw_local", "TW"],
  ["中信銀行", "tw_local", "TW"],
  ["Trend Micro", "tw_local", "TW"],
  ["趨勢科技", "tw_local", "TW"],
  ["Acer", "tw_local", "TW"],
  ["宏碁", "tw_local", "TW"],
  ["ASUS", "tw_local", "TW"],
  ["華碩", "tw_local", "TW"],
  ["HTC", "tw_local", "TW"],
  ["宏達電", "tw_local", "TW"],
  ["Garena", "tw_local", "TW"],
  ["Appier", "tw_local", "TW"],
  ["沛星互動科技", "tw_local", "TW"],
  ["KKBOX", "tw_local", "TW"],
  ["91APP", "tw_local", "TW"],
  ["iKala", "tw_local", "TW"],
  ["104 Corporation", "tw_local", "TW"],
  ["104 人力銀行", "tw_local", "TW"],
  ["Yourator", "tw_local", "TW"],
  ["CakeResume", "tw_local", "TW"],

  // ─── 大企業 (其他國家) ──────────────────────────────────────────────────
  ["Yahoo", "large_enterprise", "US"],
  ["Yahoo!", "large_enterprise", "US"],
  ["eBay", "large_enterprise", "US"],
  ["PayPal", "large_enterprise", "US"],
  ["Shopify", "large_enterprise", "CA"],
  ["Atlassian", "large_enterprise", "AU"],
  ["Twilio", "large_enterprise", "US"],
  ["Cloudflare", "large_enterprise", "US"],
  ["Booking.com", "large_enterprise", "NL"],
  ["Spotify", "large_enterprise", "SE"],
  ["Uber", "large_enterprise", "US"],
  ["Lyft", "large_enterprise", "US"],
  ["Airbnb", "large_enterprise", "US"],
  ["DoorDash", "large_enterprise", "US"],
  ["Wayfair", "large_enterprise", "US"],
  ["Lululemon", "large_enterprise", "CA"],
  ["Sanofi", "large_enterprise", "FR"],
  ["AstraZeneca", "large_enterprise", "UK"],
  ["BP", "large_enterprise", "UK"],
  ["Shell", "large_enterprise", "UK"],

  // ─── 中小企業（典型範例；以實際 Adzuna 看到的職缺為主，可逐步擴充）──
  ["Plaid", "sme", "US"],
  ["Notion", "sme", "US"],
  ["Figma", "sme", "US"],
  ["Linear", "sme", "US"],
  ["Vercel", "sme", "US"],
  ["Supabase", "sme", "US"],
  ["Retool", "sme", "US"],
  ["Brex", "sme", "US"],
  ["Ramp", "sme", "US"],

  // ─── 新創 ───────────────────────────────────────────────────────────────
  ["Cohere", "startup", "CA"],
  ["Hugging Face", "startup", "US"],
  ["Perplexity", "startup", "US"],
  ["Perplexity AI", "startup", "US"],
  ["Runway", "startup", "US"],
  ["Stability AI", "startup", "UK"],
  ["Replicate", "startup", "US"],
  ["Pinecone", "startup", "US"],
  ["Weaviate", "startup", "NL"],
  ["LangChain", "startup", "US"],
  ["Modal", "startup", "US"],
  ["Together AI", "startup", "US"],
  ["xAI", "startup", "US"],
  ["Inflection AI", "startup", "US"],
  ["Adept", "startup", "US"],
  ["Character.AI", "startup", "US"],

  // ─── Phase 2 擴充（補到 200+）──────────────────────────────────────────
  // 台灣 SME / 消費科技
  ["Gogoro", "tw_local", "TW"],
  ["Dcard", "tw_local", "TW"],
  ["PChome", "tw_local", "TW"],
  ["momo購物網", "tw_local", "TW"],
  ["Shopline", "tw_local", "TW"],
  ["TutorABC", "tw_local", "TW"],
  ["Hahow", "tw_local", "TW"],
  // 二線 / 傳統外商
  ["Tata Consultancy Services", "foreign_traditional", "IN"],
  ["Infosys", "foreign_traditional", "IN"],
  ["Capgemini", "foreign_traditional", "FR"],
  ["General Electric", "foreign_traditional", "US"],
  ["Boeing", "foreign_traditional", "US"],
  ["Lockheed Martin", "foreign_traditional", "US"],
  // 北美 / 全球大企業
  ["Carousell", "large_enterprise", "SG"],
  ["Coinbase", "large_enterprise", "US"],
  ["Reddit", "large_enterprise", "US"],
  ["Pinterest", "large_enterprise", "US"],
  ["Discord", "large_enterprise", "US"],
  ["Twitch", "large_enterprise", "US"],
  // 中型 SaaS
  ["HashiCorp", "sme", "US"],
  ["Asana", "sme", "US"],
  // 新世代 AI 新創
  ["Scale AI", "startup", "US"],
  ["Harvey AI", "startup", "US"],
  ["Cursor", "startup", "US"],
  ["Glean", "startup", "US"],
];

console.log(`Seeding ${SEED.length} company classifications...`);
let n = 0;
for (const [companyName, companyType, region] of SEED) {
  await prisma.companyClassification.upsert({
    where: { companyName },
    create: { companyName, companyType, region },
    update: { companyType, region },
  });
  n++;
}
const total = await prisma.companyClassification.count();
console.log(`Done. Upserted ${n}; total rows in table: ${total}`);

// Distribution summary
const grouped = await prisma.companyClassification.groupBy({
  by: ["companyType"],
  _count: { _all: true },
});
console.log("\nDistribution:");
for (const g of grouped) {
  console.log(`  ${g.companyType.padEnd(22)} ${g._count._all}`);
}

await prisma.$disconnect();
