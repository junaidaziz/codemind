import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { AutoFixStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const projectId = url.searchParams.get('projectId')
    const status = url.searchParams.get('status')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    const offset = (page - 1) * limit

    // Build where clause with proper typing
    const where: {
      projectId?: string
      status?: AutoFixStatus
    } = {}
    
    if (projectId) {
      where.projectId = projectId
    }
    if (status && status !== 'all') {
      // Only allow valid enum values
      if (Object.values(AutoFixStatus).includes(status as AutoFixStatus)) {
        where.status = status as AutoFixStatus
      }
    }



    // Get sessions with pagination
    const [rawSessions, total] = await Promise.all([
      prisma.autoFixSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.autoFixSession.count({ where })
    ])

    // Attach diff stats summary if present in fixesGenerated
    const sessions = rawSessions.map(s => {
      let diffStats: { totalHunks: number; totalBytes: number; truncated: boolean } | undefined;
      try {
        if (s.fixesGenerated) {
          const patches = JSON.parse(s.fixesGenerated) as Array<{ stats?: { hunks: number; bytes: number; truncated: boolean } }>;
          const withStats = patches.filter(p => p.stats);
          if (withStats.length) {
            const totalHunks = withStats.reduce((acc,p)=>acc + (p.stats?.hunks||0),0);
            const totalBytes = withStats.reduce((acc,p)=>acc + (p.stats?.bytes||0),0);
            const truncated = withStats.some(p=>p.stats?.truncated);
            diffStats = { totalHunks, totalBytes, truncated };
          }
        }
      } catch { /* ignore parse errors */ }
      return { ...s, diffStats };
    });

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching auto-fix sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}