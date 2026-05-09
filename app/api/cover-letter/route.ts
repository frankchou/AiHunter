import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// Build the default A CV filename: <UserName>_cv.pdf
function buildGeneralCvFileName(name: string | null | undefined): string {
  const slug = (name ?? "User").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "User";
  return `${slug}_cv.pdf`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cv = await prisma.coverLetter.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(cv ?? null);
  } catch {
    return NextResponse.json(null);
  }
}

// Save user-edited CV. Counts toward analysis quota (free 3/mo, pro 15, max ∞).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, fileName } = await req.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  // Saving the user's own draft is free — only AI generation consumes quota
  // (see /api/cover-letter/draft). Plain save here costs nothing.
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    await prisma.coverLetter.updateMany({
      where: { userId: session.user.id, isActive: true },
      data:  { isActive: false },
    });

    const existing = await prisma.coverLetter.findFirst({
      where: { userId: session.user.id },
      orderBy: { version: "desc" },
    });

    const cv = await prisma.coverLetter.create({
      data: {
        userId:   session.user.id,
        content:  content.trim(),
        fileName: fileName ?? buildGeneralCvFileName(user?.name ?? session.user.name),
        version:  (existing?.version ?? 0) + 1,
        isActive: true,
      },
    });
    return NextResponse.json(cv);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

