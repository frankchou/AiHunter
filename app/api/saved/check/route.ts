import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ saved: false });

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ saved: false });

  try {
    const existing = await prisma.savedJob.findUnique({
      where: { userId_jobId: { userId: session.user.id, jobId } },
    });
    return NextResponse.json({ saved: !!existing });
  } catch {
    return NextResponse.json({ saved: false });
  }
}
