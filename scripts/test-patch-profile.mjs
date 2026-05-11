// Direct prisma test bypassing HTTP — confirms the DB write path works.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const u = await prisma.user.findUnique({
  where: { email: "frank200231@gmail.com" },
  select: { id: true, lastViewedIndustry: true },
});
console.log("BEFORE:", u);

await prisma.user.update({
  where: { id: u.id },
  data: { lastViewedIndustry: "ai" },
});

const u2 = await prisma.user.findUnique({
  where: { id: u.id },
  select: { lastViewedIndustry: true },
});
console.log("AFTER:", u2);

await prisma.$disconnect();
