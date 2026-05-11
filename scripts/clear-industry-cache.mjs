// One-shot: purge IndustryCache rows + Adzuna-sourced Job rows.
// Forces next /industry visit (per-category) to regenerate using the fixed
// post-filter + canonical-name logic. After clearing, the first user to land
// on each category triggers a free auto-gen via the cache-miss path.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const before = await prisma.industryCache.count();
const beforeJobs = await prisma.job.count({ where: { source: "adzuna" } });
console.log(`Before: IndustryCache=${before}, adzuna Job rows=${beforeJobs}`);

// JobScore rows reference Job — cascade or skip? They reference jobId; if we
// delete the Job rows they cascade-delete on FK if set, otherwise need manual
// cleanup. The Job model has no onDelete: Cascade on JobScore; safer to
// delete JobScore rows for adzuna jobs first.
const adzunaJobIds = (await prisma.job.findMany({
  where: { source: "adzuna" }, select: { id: true },
})).map((j) => j.id);

if (adzunaJobIds.length) {
  const delScore = await prisma.jobScore.deleteMany({
    where: { jobId: { in: adzunaJobIds } },
  });
  console.log(`Deleted JobScore rows: ${delScore.count}`);
}

const delCache = await prisma.industryCache.deleteMany({});
const delJobs  = await prisma.job.deleteMany({ where: { source: "adzuna" } });

console.log(`Deleted IndustryCache rows: ${delCache.count}`);
console.log(`Deleted adzuna Job rows:    ${delJobs.count}`);

await prisma.$disconnect();
