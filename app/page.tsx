import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function Home() {
  const session = await getServerSession(authOptions);
  // Unauthenticated visitor → marketing landing page.
  // (Previously this redirected to /login; the new flow surfaces the
  // value proposition first; login is still one click away.)
  if (!session) return <LandingPage />;

  // Authenticated users keep the existing onboarding / feed routing.
  try {
    const resume = await prisma.resume.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    });
    if (!resume) redirect("/onboarding");
  } catch {
    // DB not available — send to onboarding to collect resume
    redirect("/onboarding");
  }

  redirect("/feed");
}
