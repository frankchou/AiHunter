import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DocType = "resume-a" | "resume-b" | "cv-a" | "cv-b";

// Preview the content of a single version. Max-only.
// Caller must pass ?type=resume-a|resume-b|cv-a|cv-b — `id` alone can't disambiguate the source table.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planTier: true, isSuperUser: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.isSuperUser && user.planTier !== "max") {
    return NextResponse.json({ error: "MAX_ONLY" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") as DocType | null;
  if (!type) return NextResponse.json({ error: "type required" }, { status: 400 });

  try {
    if (type === "resume-a") {
      const r = await prisma.resume.findFirst({
        where: { id: params.id, userId: session.user.id },
        select: { id: true, fileName: true, rawText: true, parsed: true, createdAt: true },
      });
      if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ...r, kind: "general", docType: "resume" });
    }
    if (type === "resume-b") {
      const r = await prisma.resumeTailor.findFirst({
        where: { id: params.id, userId: session.user.id },
        include: { job: { select: { title: true, company: true } } },
      });
      if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ...r, kind: "tailored", docType: "resume" });
    }
    if (type === "cv-a") {
      const c = await prisma.coverLetter.findFirst({
        where: { id: params.id, userId: session.user.id },
        select: { id: true, fileName: true, content: true, createdAt: true },
      });
      if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ...c, kind: "general", docType: "cv" });
    }
    if (type === "cv-b") {
      const c = await prisma.coverLetterTailor.findFirst({
        where: { id: params.id, userId: session.user.id },
        include: { job: { select: { title: true, company: true } } },
      });
      if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ...c, kind: "tailored", docType: "cv" });
    }
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
