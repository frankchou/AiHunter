import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCoCreateAccess } from "@/lib/ai/co-create-gate";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await ensureCoCreateAccess(session.user.id);
  if (!gate.ok) return NextResponse.json({ error: "MAX_ONLY" }, { status: 403 });

  const thread = await prisma.resumeChat.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ thread });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await ensureCoCreateAccess(session.user.id);
  if (!gate.ok) return NextResponse.json({ error: "MAX_ONLY" }, { status: 403 });

  const result = await prisma.resumeChat.deleteMany({
    where: { id: params.id, userId: session.user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
