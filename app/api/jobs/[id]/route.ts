import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MOCK_JOBS } from "@/lib/mock-data";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (job) return NextResponse.json(job);
  } catch { /* fall through to mock */ }

  const mock = MOCK_JOBS.find((j) => j.id === params.id);
  if (mock) return NextResponse.json(mock);
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
