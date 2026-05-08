import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Check if user has uploaded a resume
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
