import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JobFeed } from "@/components/jobs/JobFeed";

export const metadata = { title: "職缺流 — AI Hunter" };

export default async function FeedPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  try {
    const resume = await prisma.resume.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    });
    if (!resume) redirect("/onboarding");
  } catch {
    redirect("/onboarding");
  }

  let initialPrefs: { locations?: string[]; industries?: string[] } = {};
  try {
    const prefs = await prisma.preference.findUnique({
      where: { userId: session.user.id },
    });
    if (prefs) {
      initialPrefs = {
        locations: prefs.locations as string[],
        industries: prefs.industries as string[],
      };
    }
  } catch { /* no prefs yet */ }

  return <JobFeed initialPrefs={initialPrefs} />;
}
