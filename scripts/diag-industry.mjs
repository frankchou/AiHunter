import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const u = await prisma.user.findUnique({
  where: { email: "frank200231@gmail.com" },
  select: { id: true, lastViewedIndustry: true, planTier: true, isSuperUser: true },
});
console.log("USER:", u);

const caches = await prisma.industryCache.findMany({
  select: { industry: true, updatedAt: true },
});
console.log("INDUSTRY CACHE ROWS:");
for (const c of caches) {
  console.log(`  - ${c.industry} (updatedAt=${c.updatedAt.toISOString()})`);
}

// For each cache row, count companies and inspect OpenAI specifically
for (const c of await prisma.industryCache.findMany()) {
  const data = c.data;
  const companies = data?.companies ?? [];
  const openai = companies.find(x => /openai/i.test(x.name));
  if (openai) {
    console.log(`OpenAI in ${c.industry}:`, { name: openai.name, jobCount: openai.jobCount, region: openai.region });
  }
}

// Also count Job rows whose company contains "OpenAI"
const dbJobs = await prisma.job.count({
  where: { company: { contains: "OpenAI", mode: "insensitive" }, source: "adzuna" },
});
console.log(`Job rows with company contains "OpenAI": ${dbJobs}`);

await prisma.$disconnect();
