import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { cancelAutoFix } from '@/lib/auto-fix-orchestrator';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await prisma.autoFixSession.findUnique({ where: { id: params.id } });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const result = await cancelAutoFix(params.id);
    return NextResponse.json({ data: result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}