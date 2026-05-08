import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import type { ParsedResume, ResumeAnalysis } from "@/lib/types";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        onboardingStep: true,
        resumes: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        preferences: { select: { id: true } },
      },
    });

    const completedStep = user?.onboardingStep ?? 0;
    const resume = user?.resumes?.[0] ?? null;
    const hasPrefs = !!user?.preferences;

    // Both done → go to feed
    if (resume && hasPrefs) redirect("/feed");

    // Derive step from both the recorded step AND actual data presence
    // (guards against saveStep failing due to DB issues)
    let startStep = completedStep;
    if (resume && startStep < 1) startStep = 1; // has resume → at least confirmation step

    const parsed = resume ? (resume.parsed as unknown as ParsedResume) : null;
    const cachedAnalysis = resume?.analysis ? (resume.analysis as unknown as ResumeAnalysis) : null;

    return <OnboardingFlow initialStep={startStep} initialParsed={parsed} initialAnalysis={cachedAnalysis} />;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
  }

  return <OnboardingFlow initialStep={0} />;
}
