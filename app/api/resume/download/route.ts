import { NextResponse } from "next/server";
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
      select: { fileData: true, fileMime: true, fileName: true, rawText: true },
    });

    if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // If original file stored, return it
    if (resume.fileData) {
      const buffer = Buffer.from(resume.fileData, "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": resume.fileMime ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${resume.fileName ?? "resume"}"`,
        },
      });
    }

    // Fallback: return rawText as .txt
    return new NextResponse(resume.rawText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="resume.txt"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
}
