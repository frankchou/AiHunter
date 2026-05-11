import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const resume = await prisma.resume.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(resume ?? null);
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rawText, parsed, fileName, fileData, fileMime } = await req.json();
  if (!rawText || !parsed) return NextResponse.json({ error: "rawText and parsed required" }, { status: 400 });

  try {
    await prisma.resume.updateMany({
      where: { userId: session.user.id, isActive: true },
      data: { isActive: false },
    });

    const existing = await prisma.resume.findFirst({
      where: { userId: session.user.id },
      orderBy: { version: "desc" },
    });

    // parsedHash must be set at upload time — downstream features
    // (Top 20 auto-score, analyze cache invalidation) gate on this value
    // being non-null. Previously it was only written when the user explicitly
    // ran AI analysis, which silently broke auto-score for Max/Pro users
    // who hadn't run analysis yet.
    const parsedHash = createHash("md5")
      .update(JSON.stringify(parsed))
      .digest("hex");

    const resume = await prisma.resume.create({
      data: {
        userId: session.user.id,
        rawText,
        parsed,
        parsedHash,
        fileName: fileName ?? null,
        fileData: fileData ?? null,
        fileMime: fileMime ?? null,
        version: (existing?.version ?? 0) + 1,
        isActive: true,
      },
    });
    return NextResponse.json(resume);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
