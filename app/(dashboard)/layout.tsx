import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  try {
    const [resume, prefs] = await Promise.all([
      prisma.resume.findFirst({ where: { userId: session.user.id, isActive: true }, select: { id: true } }),
      prisma.preference.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
    ]);

    if (!resume || !prefs) redirect("/onboarding");
  } catch (e: unknown) {
    // Re-throw Next.js internal redirect so it isn't swallowed
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    // Real DB error → send to onboarding
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
