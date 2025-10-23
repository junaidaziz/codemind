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
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const days = parseInt(searchParams.get('days') || '90');
    const limit = parseInt(searchParams.get('limit') || '20');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Get userId with projectId for development fallback
    const userId = await getUserId(request, projectId || undefined);
    
    if (!userId) {
      console.error('Codebase Insights: No userId found', { 
        hasProjectId: !!projectId,
        projectId,
        url: request.url 
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

  // Try to get commit counts first (real git activity)
  const [commitCount7, commitCount30, commitCount90] = await Promise.all([
    prisma.commit.count({ where: { projectId, date: { gte: dates.last7 } } }),
    prisma.commit.count({ where: { projectId, date: { gte: dates.last30 } } }),
    prisma.commit.count({ where: { projectId, date: { gte: dates.last90 } } })
  ]);

  // If we have commit data, use it
  if (commitCount90 > 0) {
    return { last7Days: commitCount7, last30Days: commitCount30, last90Days: commitCount90 };
  }

  // Fallback to activity events
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

  // Try to get data from commits first (real git data)
  const commits = await prisma.commit.findMany({
    where: {
      projectId,
      date: { gte: sinceDate }
    },
    orderBy: { date: 'desc' },
    take: 500
  });

  const fileMap = new Map<string, FileStats>();
  
  // Process commits to get file statistics
  commits.forEach(commit => {
    const files = commit.filesChanged || [];
    files.forEach((filePath: string) => {
      const existing = fileMap.get(filePath);
      if (existing) {
        existing.changes++;
        existing.additions += commit.additions || 0;
        existing.deletions += commit.deletions || 0;
        // Keep the most recent modification date
        if (new Date(commit.date) > new Date(existing.lastModified)) {
          existing.lastModified = commit.date.toISOString();
        }
      } else {
        fileMap.set(filePath, {
          path: filePath,
          changes: 1,
          additions: commit.additions || 0,
          deletions: commit.deletions || 0,
          lastModified: commit.date.toISOString()
        });
      }
    });
  });

  // If we have commit data, use it
  if (fileMap.size > 0) {
    // Get file sizes from CodeChunk data
    const filePaths = Array.from(fileMap.keys());
    const chunks = await prisma.codeChunk.findMany({
      where: {
        projectId,
        path: { in: filePaths }
      },
      select: {
        path: true,
        startLine: true,
        endLine: true
      }
    });

    // Calculate lines per file
    const linesMap = new Map<string, number>();
    chunks.forEach(chunk => {
      const lines = chunk.endLine - chunk.startLine + 1;
      linesMap.set(chunk.path, (linesMap.get(chunk.path) || 0) + lines);
    });

    // Add line counts to file stats
    fileMap.forEach((stats, path) => {
      stats.lines = linesMap.get(path) || 0;
    });

    return Array.from(fileMap.values())
      .sort((a, b) => b.changes - a.changes)
      .slice(0, limit);
  }

  // Fallback: If no commits, get data from indexed chunks
  const chunks = await prisma.codeChunk.findMany({
    where: { projectId },
    select: {
      path: true,
      startLine: true,
      endLine: true,
      updatedAt: true
    },
    orderBy: { updatedAt: 'desc' },
    take: 1000
  });

  // Group by file path
  const chunkFileMap = new Map<string, { lines: number; lastModified: string }>();
  chunks.forEach(chunk => {
    const lines = chunk.endLine - chunk.startLine + 1;
    const existing = chunkFileMap.get(chunk.path);
    if (existing) {
      existing.lines += lines;
      if (new Date(chunk.updatedAt) > new Date(existing.lastModified)) {
        existing.lastModified = chunk.updatedAt.toISOString();
      }
    } else {
      chunkFileMap.set(chunk.path, {
        lines,
        lastModified: chunk.updatedAt.toISOString()
      });
    }
  });

  // Convert to FileStats (with estimated changes based on recency)
  return Array.from(chunkFileMap.entries())
    .map(([path, data]) => ({
      path,
      changes: 1, // Estimate: at least indexed once
      additions: 0,
      deletions: 0,
      lastModified: data.lastModified,
      lines: data.lines
    }))
    .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
    .slice(0, limit);
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
