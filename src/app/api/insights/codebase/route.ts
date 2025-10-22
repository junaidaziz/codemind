import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getUserId } from '@/lib/auth-server';

interface FileStats {
  path: string;
  changes: number;
  additions: number;
  deletions: number;
  lastModified: string;
  size?: number;
  lines?: number;
}

interface ComplexityHotspot {
  path: string;
  score: number;
  lines: number;
}

interface CodebaseInsights {
  mostChangedFiles: FileStats[];
  fileTypeDistribution: Record<string, number>;
  complexityHotspots: ComplexityHotspot[];
  codeChurn: {
    totalFiles: number;
    totalChanges: number;
    averageChangesPerFile: number;
  };
  recentActivity: {
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
  cached: boolean;
  lastUpdated: string;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const days = parseInt(searchParams.get('days') || '90');
    const limit = parseInt(searchParams.get('limit') || '20');
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: userId
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!forceRefresh) {
      const cachedInsights = await getCachedInsights(projectId, days);
      if (cachedInsights) {
        return NextResponse.json(cachedInsights);
      }
    }

    const insights = await generateCodebaseInsights(projectId, days, limit);
    await cacheInsights(projectId, days, insights);

    return NextResponse.json(insights);

  } catch (error) {
    console.error('Codebase Insights API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch codebase insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function generateCodebaseInsights(projectId: string, days: number, limit: number): Promise<CodebaseInsights> {
  const insights: CodebaseInsights = {
    mostChangedFiles: [],
    fileTypeDistribution: {},
    complexityHotspots: [],
    codeChurn: { totalFiles: 0, totalChanges: 0, averageChangesPerFile: 0 },
    recentActivity: { last7Days: 0, last30Days: 0, last90Days: 0 },
    cached: false,
    lastUpdated: new Date().toISOString()
  };

  insights.mostChangedFiles = await getFileStatsFromActivity(projectId, days, limit);
  insights.fileTypeDistribution = calculateFileTypeDistribution(insights.mostChangedFiles);
  
  insights.complexityHotspots = insights.mostChangedFiles
    .filter(f => f.lines && f.lines > 100)
    .map(f => ({ path: f.path, score: f.changes * (f.lines || 0) / 1000, lines: f.lines || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const totalChanges = insights.mostChangedFiles.reduce((sum, f) => sum + f.changes, 0);
  insights.codeChurn = {
    totalFiles: insights.mostChangedFiles.length,
    totalChanges,
    averageChangesPerFile: insights.mostChangedFiles.length > 0 ? totalChanges / insights.mostChangedFiles.length : 0
  };

  insights.recentActivity = await getRecentActivityCounts(projectId);
  return insights;
}

function calculateFileTypeDistribution(fileStats: FileStats[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  fileStats.forEach(file => {
    const ext = file.path.split('.').pop()?.toLowerCase() || 'unknown';
    distribution[ext] = (distribution[ext] || 0) + 1;
  });
  return distribution;
}

async function getRecentActivityCounts(projectId: string): Promise<{ last7Days: number; last30Days: number; last90Days: number }> {
  const now = new Date();
  const dates = {
    last7: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    last30: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    last90: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  };

  const [count7, count30, count90] = await Promise.all([
    prisma.activityEvent.count({ where: { projectId, createdAt: { gte: dates.last7 } } }),
    prisma.activityEvent.count({ where: { projectId, createdAt: { gte: dates.last30 } } }),
    prisma.activityEvent.count({ where: { projectId, createdAt: { gte: dates.last90 } } })
  ]);

  return { last7Days: count7, last30Days: count30, last90Days: count90 };
}

async function getFileStatsFromActivity(projectId: string, days: number, limit: number): Promise<FileStats[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const activities = await prisma.activityEvent.findMany({
    where: { projectId, createdAt: { gte: sinceDate }, eventType: { in: ['APR_CODE_GENERATION', 'APR_COMPLETED', 'APR_PR_CREATED'] } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  const fileMap = new Map<string, FileStats>();
  activities.forEach(activity => {
    if (!activity.metadata || typeof activity.metadata !== 'object') {
      return;
    }
    const metadata = activity.metadata as unknown as Record<string, unknown>;
    const files = (metadata?.files as string[]) || (metadata?.modifiedFiles as string[]) || [];
    files.forEach((file: string) => {
      const existing = fileMap.get(file);
      if (existing) {
        existing.changes++;
      } else {
        fileMap.set(file, { path: file, changes: 1, additions: 0, deletions: 0, lastModified: activity.createdAt.toISOString() });
      }
    });
  });

  return Array.from(fileMap.values()).sort((a, b) => b.changes - a.changes).slice(0, limit);
}

async function getCachedInsights(projectId: string, days: number): Promise<CodebaseInsights | null> {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  try {
    const cached = await prisma.activityEvent.findFirst({
      where: { projectId, title: { contains: `Codebase insights cached (${days} days)` }, createdAt: { gte: oneHourAgo } },
      orderBy: { createdAt: 'desc' }
    });

    if (cached && cached.metadata) {
      const insights = cached.metadata as unknown as CodebaseInsights;
      return { ...insights, cached: true, lastUpdated: cached.createdAt.toISOString() };
    }
  } catch (cacheError) {
    console.error('Cache retrieval error:', cacheError);
  }
  return null;
}

async function cacheInsights(projectId: string, days: number, insights: CodebaseInsights): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        projectId,
        eventType: 'INDEXING_COMPLETED',
        entityType: 'codebase_insights',
        status: 'COMPLETED',
        title: `Codebase insights cached (${days} days)`,
        metadata: JSON.stringify(insights)
      }
    });
  } catch (cacheError) {
    console.error('Cache storage error:', cacheError);
  }
}
