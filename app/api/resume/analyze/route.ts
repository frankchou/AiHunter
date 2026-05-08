import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeResume } from "@/lib/ai/resume-analyzer";
import type { ParsedResume } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { parsed } = await req.json() as { parsed: ParsedResume };
  if (!parsed) return NextResponse.json({ error: "parsed required" }, { status: 400 });

  try {
    const analysis = await analyzeResume(parsed);
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze route] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
