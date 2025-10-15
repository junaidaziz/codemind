import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '../../../../lib/auth-server';
import { createApiError, createApiSuccess } from '../../../../types';
import { startAutoFix } from '../../../../lib/auto-fix-orchestrator';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body = await request.json().catch(() => ({}));
    const { projectId, issueId, issueNumber } = body || {};
    if (!projectId) {
      return NextResponse.json(createApiError('projectId is required', 'VALIDATION_ERROR'), { status: 400 });
    }
    const plan = await startAutoFix({ projectId, userId, issueId, issueNumber });
    return NextResponse.json(createApiSuccess({ message: 'AutoFix session started', plan }));
  } catch (e) {
    return NextResponse.json(
      createApiError(`Failed to start AutoFix: ${e instanceof Error ? e.message : 'Unknown error'}`, 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}
