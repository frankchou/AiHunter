import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseResumeText } from "@/lib/ai/resume-parser";
import { consumeUsage } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bill = await consumeUsage(session.user.id, "analysis");
  if (!bill.ok) {
    return NextResponse.json({
      error: "LIMIT_REACHED",
      planTier: bill.planTier,
      tickets: bill.tickets,
      adSessionsLeft: bill.adSessionsLeft,
    }, { status: 402 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  let rawText = "";
  let fileName: string | null = null;
  let fileData: string | null = null; // base64
  let fileMime: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await req.json();
    rawText = body.text ?? "";
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    fileName = file.name;
    fileMime = file.type || "application/octet-stream";
    const buffer = Buffer.from(await file.arrayBuffer());
    fileData = buffer.toString("base64");

    if (file.name.endsWith(".pdf")) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const result = await pdfParse(buffer);
        rawText = result.text;
      } catch {
        rawText = buffer.toString("utf-8");
      }
    } else if (file.name.endsWith(".docx")) {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value;
      } catch {
        rawText = buffer.toString("utf-8");
      }
    } else {
      rawText = buffer.toString("utf-8");
      fileData = null; // plain text — rawText is enough
    }
  } else {
    return NextResponse.json({ error: "Unsupported content-type" }, { status: 400 });
  }

  if (!rawText.trim()) return NextResponse.json({ error: "Empty content" }, { status: 400 });

  try {
    const parsed = await parseResumeText(rawText);
    return NextResponse.json({ rawText, parsed, fileName, fileData, fileMime });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
