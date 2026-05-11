// One-shot migration: compute parsedHash for any Resume row where it's null.
// Safe to re-run — only touches rows where parsedHash IS NULL.
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

const rows = await prisma.resume.findMany({
  where: { parsedHash: null },
  select: { id: true, userId: true, version: true, parsed: true, isActive: true },
});

console.log(`Found ${rows.length} resume row(s) with null parsedHash`);

let updated = 0;
for (const r of rows) {
  const parsedHash = createHash("md5")
    .update(JSON.stringify(r.parsed))
    .digest("hex");
  await prisma.resume.update({
    where: { id: r.id },
    data: { parsedHash },
  });
  console.log(`  ✓ ${r.id} (user=${r.userId} v${r.version} active=${r.isActive}) → ${parsedHash}`);
  updated++;
}

console.log(`Backfilled ${updated} row(s).`);
await prisma.$disconnect();
