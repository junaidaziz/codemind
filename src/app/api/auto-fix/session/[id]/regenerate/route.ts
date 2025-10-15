import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';
import { regenerateAutoFix } from '@/lib/auto-fix-orchestrator';

type IdParams = { id: string };
type Ctx = { params: IdParams } | { params: Promise<IdParams> };

export async function POST(_req: NextRequest, context: Ctx) {
  try {
    const raw = context.params;
    const isPromise = <T,>(v: T | Promise<T>): v is Promise<T> => typeof (v as object) === 'object' && v !== null && 'then' in (v as object);
    const params: IdParams = isPromise(raw) ? await raw : raw;
    if (!params?.id) {
      return NextResponse.json({ error: 'Missing id param' }, { status: 400 });
    }
    const session = await prisma.autoFixSession.findUnique({ where: { id: params.id } });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const result = await regenerateAutoFix(params.id);
    return NextResponse.json({ data: result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}