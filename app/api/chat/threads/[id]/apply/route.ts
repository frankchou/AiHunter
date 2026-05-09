import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCoCreateAccess } from "@/lib/ai/co-create-gate";
import type { ParsedResume } from "@/lib/types";

// Apply a stored proposal (from a prior assistant message) to the actual source
// document. The proposal lives on a ResumeChatMessage; we look up the chat,
// resolve which doc to mutate from chat.docKind / jobId, and write the new
// "after" value into the right field.
//
// Body: { messageId: string }
// On success: marks the message applied=true and returns { ok: true }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await ensureCoCreateAccess(session.user.id);
  if (!gate.ok) return NextResponse.json({ error: "MAX_ONLY" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const messageId: string = body.messageId;
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const thread = await prisma.resumeChat.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const msg = await prisma.resumeChatMessage.findFirst({
    where: { id: messageId, chatId: thread.id },
  });
  if (!msg || !msg.editTarget || msg.editAfter == null) {
    return NextResponse.json({ error: "No proposal on this message" }, { status: 400 });
  }
  if (msg.applied) {
    return NextResponse.json({ error: "Already applied" }, { status: 400 });
  }

  const target  = msg.editTarget;
  const after   = msg.editAfter;
  const userId  = session.user.id;
  const docKind = thread.docKind;
  const jobId   = thread.jobId;

  try {
    if (docKind === "cv-a") {
      // Single-field text doc — overwrite content (creates a new active version)
      const cur = await prisma.coverLetter.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: "desc" },
      });
      await prisma.coverLetter.updateMany({
        where: { userId, isActive: true },
        data:  { isActive: false },
      });
      await prisma.coverLetter.create({
        data: {
          userId,
          content:  after,
          fileName: cur?.fileName ?? null,
          version:  (cur?.version ?? 0) + 1,
          isActive: true,
        },
      });

    } else if (docKind === "cv-b") {
      if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
      const cur = await prisma.coverLetterTailor.findFirst({
        where: { userId, jobId, isCurrent: true },
        orderBy: { createdAt: "desc" },
      });
      await prisma.coverLetterTailor.updateMany({
        where: { userId, jobId, isCurrent: true },
        data:  { isCurrent: false },
      });
      await prisma.coverLetterTailor.create({
        data: {
          userId, jobId,
          content:   after,
          fileName:  cur?.fileName ?? null,
          isCurrent: true,
        },
      });

    } else if (docKind === "resume-a") {
      // Edit a structured field. target = "summary" or "bullet:<eIdx>:<bIdx>"
      const cur = await prisma.resume.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: "desc" },
      });
      if (!cur) return NextResponse.json({ error: "No active resume" }, { status: 400 });
      const parsed = JSON.parse(JSON.stringify(cur.parsed)) as ParsedResume;
      if (target === "summary") {
        parsed.summary = after;
      } else if (target.startsWith("bullet:")) {
        const [, eIdx, bIdx] = target.split(":").map(Number);
        const exp = parsed.experience?.[eIdx];
        if (!exp) return NextResponse.json({ error: "Bad bullet target" }, { status: 400 });
        if (!exp.bullets) exp.bullets = [];
        exp.bullets[bIdx] = after;
      } else {
        return NextResponse.json({ error: "Unsupported target" }, { status: 400 });
      }
      // Mark old inactive, create new version
      await prisma.resume.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
      await prisma.resume.create({
        data: {
          userId,
          rawText:  cur.rawText,
          parsed:   parsed as unknown as object,
          fileName: cur.fileName,
          fileData: cur.fileData,
          fileMime: cur.fileMime,
          version:  cur.version + 1,
          isActive: true,
        },
      });

    } else if (docKind === "resume-b") {
      if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
      const cur = await prisma.resumeTailor.findFirst({
        where: { userId, jobId, isCurrent: true },
        orderBy: { createdAt: "desc" },
      });
      if (!cur) return NextResponse.json({ error: "No tailored resume" }, { status: 400 });
      const summary = JSON.parse(JSON.stringify(cur.summary)) as { before: string; after: string };
      const bullets = JSON.parse(JSON.stringify(cur.bullets)) as { before: string; after: string }[];
      if (target === "summary") {
        summary.after = after;
      } else if (target.startsWith("bullet:")) {
        const [, idx] = target.split(":").map(Number);
        if (!bullets[idx]) return NextResponse.json({ error: "Bad bullet target" }, { status: 400 });
        bullets[idx].after = after;
      } else {
        return NextResponse.json({ error: "Unsupported target" }, { status: 400 });
      }
      await prisma.resumeTailor.updateMany({
        where: { userId, jobId, isCurrent: true },
        data:  { isCurrent: false },
      });
      await prisma.resumeTailor.create({
        data: {
          userId, jobId,
          fileName:  cur.fileName,
          isCurrent: true,
          summary:   summary as unknown as object,
          bullets:   bullets as unknown as object,
          diffNote:  cur.diffNote,
        },
      });

    } else {
      return NextResponse.json({ error: "General chat has no doc to apply to" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  await prisma.resumeChatMessage.update({
    where: { id: msg.id },
    data:  { applied: true },
  });
  return NextResponse.json({ ok: true });
}
