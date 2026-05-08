import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Save completed step + any associated data for that step
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { step, data } = await req.json();

  try {
    await prisma.$transaction(async (tx) => {
      // Update completed step marker on User
      await tx.user.update({
        where: { id: session.user.id },
        data: { onboardingStep: step },
      });

      // Step 2 completed: save preferences
      if (step === 2 && data?.prefs) {
        await tx.preference.upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id, ...data.prefs },
          update: data.prefs,
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingStep: true },
    });
    return NextResponse.json({ step: user?.onboardingStep ?? 0 });
  } catch {
    return NextResponse.json({ step: 0 });
  }
}
