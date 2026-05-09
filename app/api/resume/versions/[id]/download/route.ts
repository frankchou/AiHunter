import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Download a version. Currently only A 履歷 with stored fileData is supported;
// other types respond 405 (per spec — PDF rendering for AI-generated docs is a follow-up).
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

  const type = req.nextUrl.searchParams.get("type");
  if (type !== "resume-a") {
    return NextResponse.json({ error: "DOWNLOAD_NOT_AVAILABLE_YET" }, { status: 405 });
  }

  try {
    const r = await prisma.resume.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: { fileData: true, fileMime: true, fileName: true, rawText: true },
    });
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (r.fileData) {
      const buffer = Buffer.from(r.fileData, "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": r.fileMime ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${r.fileName ?? "resume"}"`,
        },
      });
    }
    return new NextResponse(r.rawText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="resume.txt"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
