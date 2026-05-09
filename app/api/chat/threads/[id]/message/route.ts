import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCoCreateAccess } from "@/lib/ai/co-create-gate";
import { coCreateReply } from "@/lib/ai/co-create";
import type { DocKind, ChatTurn } from "@/lib/ai/co-create";
import { loadDocSnapshot } from "@/lib/ai/co-create-doc";

const HISTORY_TURNS = 20; // last 20 messages of the thread sent as context

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await ensureCoCreateAccess(session.user.id);
  if (!gate.ok) return NextResponse.json({ error: "MAX_ONLY" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userText: string = (body.content ?? "").toString().trim();
  if (!userText) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const thread = await prisma.resumeChat.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, docKind: true, jobId: true, title: true },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Pull recent history for context
  const recent = await prisma.resumeChatMessage.findMany({
    where: { chatId: thread.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS,
    select: { role: true, content: true },
  });
  const history: ChatTurn[] = recent.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Snapshot the doc the user is editing
  const snap = await loadDocSnapshot({
    userId:  session.user.id,
    docKind: thread.docKind as DocKind,
    jobId:   thread.jobId,
  });
  if (!snap) return NextResponse.json({ error: "Cannot resolve doc context" }, { status: 400 });

  // Persist the user message first so the conversation is durable even if AI errors
  const userMsg = await prisma.resumeChatMessage.create({
    data: { chatId: thread.id, role: "user", content: userText },
  });

  let ai;
  try {
    ai = await coCreateReply(snap, history, userText);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const assistantMsg = await prisma.resumeChatMessage.create({
    data: {
      chatId:     thread.id,
      role:       "assistant",
      content:    ai.reply,
      editTarget: ai.proposal?.target ?? null,
      editBefore: ai.proposal?.before ?? null,
      editAfter:  ai.proposal?.after  ?? null,
      applied:    false,
    },
  });

  // Touch thread + auto-title from first user message
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (thread.title === "新對話") {
    updates.title = userText.slice(0, 40);
  }
  await prisma.resumeChat.update({ where: { id: thread.id }, data: updates });

  return NextResponse.json({
    userMessage:      userMsg,
    assistantMessage: assistantMsg,
  });
}
