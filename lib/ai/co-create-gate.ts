import { prisma } from "@/lib/prisma";

/** Confirm the user is allowed to use co-create (Max plan or super user). */
export async function ensureCoCreateAccess(userId: string): Promise<{ ok: boolean; planTier: string }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { planTier: true, isSuperUser: true },
  });
  const planTier = u?.planTier ?? "free";
  const ok = !!u && (u.isSuperUser || planTier === "max");
  return { ok, planTier };
}
