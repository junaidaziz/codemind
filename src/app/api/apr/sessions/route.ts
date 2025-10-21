import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import prisma from '@/lib/db';
import { Prisma, AutoFixStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Prisma.AutoFixSessionWhereInput = {
      userId: user.id,
    };

    if (projectId) {
      where.projectId = projectId;
    }

    if (status) {
      where.status = status as AutoFixStatus;
    }

    const [sessions, total] = await Promise.all([
      prisma.autoFixSession.findMany({
        where,
        include: {
          AutoFixAttempt: {
            orderBy: { attemptNumber: 'asc' },
          },
          AutoFixResult: {
            orderBy: { createdAt: 'desc' },
          },
          AutoFixReview: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.autoFixSession.count({ where }),
    ]);

    return NextResponse.json({
      sessions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching APR sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch APR sessions' },
      { status: 500 }
    );
  }
}
