import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { JobFeed } from "@/components/jobs/JobFeed";

export const metadata = { title: "職缺流 — AI Hunter" };

export default async function FeedPage() {
  const session = await getServerSession(authOptions);

  let initialPrefs: { locations?: string[]; industries?: string[] } = {};
  try {
    const { prisma } = await import("@/lib/prisma");
    if (session?.user?.id) {
      const prefs = await prisma.preference.findUnique({ where: { userId: session.user.id } });
      if (prefs) {
        initialPrefs = {
          locations: prefs.locations as string[],
          industries: prefs.industries as string[],
        };
      }
    }
  } catch { /* no prefs */ }

  return <JobFeed initialPrefs={initialPrefs} />;
}
