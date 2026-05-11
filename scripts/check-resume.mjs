import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const u = await prisma.user.findUnique({
  where: { email: "frank200231@gmail.com" },
  select: { id: true, email: true, planTier: true, isSuperUser: true },
});
if (!u) { console.log("NO USER FOUND"); process.exit(0); }
console.log("USER:", u);
const resumes = await prisma.resume.findMany({
  where: { userId: u.id },
  orderBy: { createdAt: "desc" },
  select: {
    id: true, version: true, isActive: true, fileName: true,
    parsedHash: true, createdAt: true,
  },
});
console.log("RESUMES:", JSON.stringify(resumes, null, 2));
const active = resumes.find(r => r.isActive);
console.log("ACTIVE RESUME parsedHash:", active?.parsedHash ?? null);
await prisma.$disconnect();
