import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const period = searchParams.get('period') || 'monthly';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    const defaultStartDate = new Date(now);
    
    switch (period) {
      case 'daily':
        defaultStartDate.setDate(now.getDate() - 30);
        break;
      case 'weekly':
        defaultStartDate.setDate(now.getDate() - 12 * 7);
        break;
      case 'monthly':
        defaultStartDate.setMonth(now.getMonth() - 12);
        break;
      case 'quarterly':
        defaultStartDate.setMonth(now.getMonth() - 24);
        break;
      case 'yearly':
        defaultStartDate.setFullYear(now.getFullYear() - 3);
        break;
    }

    const periodStartDate = startDate ? new Date(startDate) : defaultStartDate;
    const periodEndDate = endDate ? new Date(endDate) : now;

    // Fetch analytics data
    const [
      developerInsights,
      // autoFixMetrics, // Unused variable - commented out
      activityLogs,
      pullRequests,
      issues,
      autoFixSessions
    ] = await Promise.all([
      // Developer insights for the period
      prisma.developerInsights.findMany({
        where: {
          projectId,
          period,
          periodStart: { gte: periodStartDate },
          periodEnd: { lte: periodEndDate }
        },
        orderBy: { periodStart: 'asc' }
      }),

      // Auto fix metrics - commented out as unused
      // prisma.autoFixMetrics.findMany({
      //   where: {
      //     projectId,
      //     periodStart: { gte: periodStartDate },
      //     periodEnd: { lte: periodEndDate }
      //   },
      //   orderBy: { periodStart: 'asc' }
      // }),

      // Recent activity logs
      prisma.activityLog.findMany({
        where: {
          projectId,
          createdAt: { 
            gte: periodStartDate,
            lte: periodEndDate
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),

      // Pull requests in period
      prisma.pullRequest.findMany({
        where: {
          projectId,
          createdAt: {
            gte: periodStartDate,
            lte: periodEndDate
          }
        }
      }),

      // Issues in period  
      prisma.issue.findMany({
        where: {
          projectId,
          createdAt: {
            gte: periodStartDate,
            lte: periodEndDate
          }
        }
      }),

      // Auto fix sessions
      prisma.autoFixSession.findMany({
        where: {
          projectId,
          createdAt: {
            gte: periodStartDate,
            lte: periodEndDate
          }
        },
        include: {
          results: true
        }
      })
    ]);

    // Calculate summary metrics
    const totalAiFixes = autoFixSessions.length;
    const successfulFixes = autoFixSessions.filter(s => s.status === 'COMPLETED').length;
    const failedFixes = autoFixSessions.filter(s => s.status === 'FAILED').length;
    const successRate = totalAiFixes > 0 ? (successfulFixes / totalAiFixes) * 100 : 0;

    const totalPRsCreated = pullRequests.length;
    const totalPRsMerged = pullRequests.filter(pr => pr.state === 'MERGED').length;
    const prMergeRate = totalPRsCreated > 0 ? (totalPRsMerged / totalPRsCreated) * 100 : 0;

    const totalIssues = issues.length;
    const closedIssues = issues.filter(issue => issue.state === 'CLOSED').length;

    // Calculate time savings (estimate based on successful fixes)
    const avgFixTimeMinutes = 45; // Average time saved per AI fix
    const totalTimeSaved = successfulFixes * avgFixTimeMinutes;
    const estimatedHoursSaved = totalTimeSaved / 60;

    // Activity breakdown
    const activityBreakdown = activityLogs.reduce((acc, log) => {
      acc[log.activityType] = (acc[log.activityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Prepare time series data for charts
    const timeSeriesData = developerInsights.map(insight => ({
      date: insight.periodStart.toISOString().split('T')[0],
      aiFixes: insight.totalAiFixes,
      successRate: insight.successRate,
      hoursSaved: insight.estimatedHoursSaved,
      prsCreated: insight.totalPRsCreated,
      issuesResolved: insight.totalIssuesResolved
    }));

    const analytics = {
      summary: {
        totalAiFixes,
        successfulFixes,
        failedFixes,
        successRate: Math.round(successRate * 100) / 100,
        totalPRsCreated,
        totalPRsMerged,
        prMergeRate: Math.round(prMergeRate * 100) / 100,
        totalIssues,
        closedIssues,
        estimatedHoursSaved: Math.round(estimatedHoursSaved * 100) / 100,
        totalTimeSavedMinutes: totalTimeSaved
      },
      timeSeriesData,
      activityBreakdown,
      recentActivity: activityLogs.slice(0, 20),
      period: {
        start: periodStartDate.toISOString(),
        end: periodEndDate.toISOString(),
        type: period
      }
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Developer Insights API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch developer insights' },
      { status: 500 }
    );
  }
}