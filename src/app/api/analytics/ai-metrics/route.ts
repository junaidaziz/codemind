import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/db';
import { getUserId } from '@/lib/auth-server';

interface ActivityMetadata {
  testsGenerated?: number;
  [key: string]: unknown;
}

interface DateCounts {
  started: number;
  completed: number;
  failed: number;
}

interface ProjectActivity {
  projectId: string;
  fixes: number;
  prs: number;
  tests: number;
  total: number;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    } : {};

    // Build project filter
    const projectFilter = projectId ? { projectId } : {};

    // Fetch AI fix metrics from ActivityEvent
    const aiFixes = await prisma.activityEvent.findMany({
      where: {
        userId,
        ...projectFilter,
        ...dateFilter,
        eventType: {
          in: ['AUTO_FIX_STARTED', 'AUTO_FIX_COMPLETED', 'AUTO_FIX_FAILED']
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch PR metrics from ActivityEvent
    const aiPRs = await prisma.activityEvent.findMany({
      where: {
        userId,
        ...projectFilter,
        ...dateFilter,
        eventType: {
          in: ['APR_PR_CREATED', 'APR_COMPLETED']
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch test generation metrics from ActivityEvent
    const testGeneration = await prisma.activityEvent.findMany({
      where: {
        userId,
        ...projectFilter,
        ...dateFilter,
        eventType: 'TEST_GENERATION',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate metrics
    const totalFixes = aiFixes.length;
    const successfulFixes = aiFixes.filter((a) => a.status === 'COMPLETED').length;
    const failedFixes = aiFixes.filter((a) => a.status === 'FAILED').length;
    const successRate = totalFixes > 0 ? (successfulFixes / totalFixes) * 100 : 0;

    const totalPRs = aiPRs.length;
    const totalTests = testGeneration.reduce((acc: number, activity) => {
      const metadata = activity.metadata as ActivityMetadata;
      return acc + (metadata?.testsGenerated || 0);
    }, 0);

    // Calculate time saved (estimated)
    const avgTimePerFix = 30; // minutes
    const avgTimePerPR = 45; // minutes
    const avgTimePerTest = 15; // minutes
    const timeSaved = 
      (successfulFixes * avgTimePerFix) +
      (totalPRs * avgTimePerPR) +
      (totalTests * avgTimePerTest);

    // Group fixes by date for trend analysis
    const fixesByDate = aiFixes.reduce((acc: Record<string, DateCounts>, fix) => {
      const date = fix.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { started: 0, completed: 0, failed: 0 };
      }
      if (fix.status === 'IN_PROGRESS') acc[date].started++;
      if (fix.status === 'COMPLETED') acc[date].completed++;
      if (fix.status === 'FAILED') acc[date].failed++;
      return acc;
    }, {});

    const trendData = Object.entries(fixesByDate).map(([date, counts]): { date: string; started: number; completed: number; failed: number; successRate: number } => ({
      date,
      started: counts.started,
      completed: counts.completed,
      failed: counts.failed,
      successRate: counts.started > 0 ? (counts.completed / counts.started) * 100 : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Top projects by AI activity
    const projectActivity = [...aiFixes, ...aiPRs, ...testGeneration].reduce((acc: Record<string, ProjectActivity>, activity) => {
      const pid = activity.projectId;
      if (pid) {
        if (!acc[pid]) {
          acc[pid] = { projectId: pid, fixes: 0, prs: 0, tests: 0, total: 0 };
        }
        if (activity.eventType.includes('AUTO_FIX')) acc[pid].fixes++;
        if (activity.eventType.includes('APR_PR') || activity.eventType.includes('APR_COMPLETED')) acc[pid].prs++;
        if (activity.eventType === 'TEST_GENERATION') {
          const metadata = activity.metadata as ActivityMetadata;
          acc[pid].tests += metadata?.testsGenerated || 0;
        }
        acc[pid].total++;
      }
      return acc;
    }, {});

    const topProjects = Object.values(projectActivity)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Recent AI actions
    const recentActions = [...aiFixes, ...aiPRs, ...testGeneration]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map(action => ({
        id: action.id,
        eventType: action.eventType,
        entityType: action.entityType,
        projectId: action.projectId,
        title: action.title,
        description: action.description,
        status: action.status,
        duration: action.duration,
        metadata: action.metadata,
        createdAt: action.createdAt.toISOString(),
      }));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalFixes,
          successfulFixes,
          failedFixes,
          successRate: Math.round(successRate),
          totalPRs,
          totalTests,
          timeSaved,
        },
        trends: trendData,
        topProjects,
        recentActions,
      },
    });

  } catch (error) {
    console.error('Error fetching AI metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI metrics' },
      { status: 500 }
    );
  }
}
