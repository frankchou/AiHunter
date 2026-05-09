import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCoCreateAccess } from "@/lib/ai/co-create-gate";

const MAX_THREADS_PER_USER = 30;
const VALID_KINDS = new Set(["resume-a", "cv-a", "resume-b", "cv-b", "general"]);

// List threads for current user, optionally scoped to a (docKind, jobId) context
// so the panel can show "this doc's history" vs "all my chats".
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await ensureCoCreateAccess(session.user.id);
  if (!gate.ok) return NextResponse.json({ error: "MAX_ONLY", planTier: gate.planTier }, { status: 403 });

  const docKind = req.nextUrl.searchParams.get("docKind");
  const jobId   = req.nextUrl.searchParams.get("jobId");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (docKind && VALID_KINDS.has(docKind)) where.docKind = docKind;
  if (jobId) where.jobId = jobId;

  const threads = await prisma.resumeChat.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true, title: true, docKind: true, jobId: true, createdAt: true, updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
  return NextResponse.json({ threads });
}

// Create a new thread. Body: { docKind, jobId? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await ensureCoCreateAccess(session.user.id);
  if (!gate.ok) return NextResponse.json({ error: "MAX_ONLY", planTier: gate.planTier }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const docKind: string = body.docKind;
  const jobId: string | null = body.jobId ?? null;
  if (!VALID_KINDS.has(docKind)) {
    return NextResponse.json({ error: "Invalid docKind" }, { status: 400 });
  }
  if ((docKind === "resume-b" || docKind === "cv-b") && !jobId) {
    return NextResponse.json({ error: "jobId required for B docs" }, { status: 400 });
  }

  // Prune oldest threads beyond the cap
  const total = await prisma.resumeChat.count({ where: { userId: session.user.id } });
  if (total >= MAX_THREADS_PER_USER) {
    const surplus = total - MAX_THREADS_PER_USER + 1;
    const stale = await prisma.resumeChat.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "asc" },
      take: surplus,
      select: { id: true },
    });
    if (stale.length) {
      await prisma.resumeChat.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
  }

  const thread = await prisma.resumeChat.create({
    data: {
      userId:  session.user.id,
      title:   "新對話",
      docKind,
      jobId,
    },
  });
  return NextResponse.json({ thread });
}
