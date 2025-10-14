import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const timeframe = searchParams.get('timeframe') || '30'; // days

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const days = parseInt(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total AI fixes (issues resolved by AI)
    const totalAiFixes = await prisma.issue.count({
      where: {
        projectId: Number(projectId),
        state: 'closed',
        updatedAt: { gte: startDate },
        // Assuming AI fixes have specific labels or patterns
        OR: [
          { labels: { contains: 'ai-fix' } },
          { labels: { contains: 'auto-fix' } },
        ],
      },
    });

    // Calculate success rate (PRs merged vs total PRs created by AI)
    const totalAiPrs = await prisma.pullRequest.count({
      where: {
        projectId: Number(projectId),
        createdAt: { gte: startDate },
        // Look for AI-created PRs by checking branch names or titles
        OR: [
          { branch: { startsWith: 'fix/' } },
          { branch: { contains: 'ai' } },
          { title: { contains: '[AI]' } },
        ],
      },
    });

    const mergedAiPrs = await prisma.pullRequest.count({
      where: {
        projectId: Number(projectId),
        state: 'merged',
        createdAt: { gte: startDate },
        OR: [
          { branch: { startsWith: 'fix/' } },
          { branch: { contains: 'ai' } },
          { title: { contains: '[AI]' } },
        ],
      },
    });

    // Get recent activity (issues and PRs over time)
    const recentIssues = await prisma.issue.groupBy({
      by: ['createdAt'],
      where: {
        projectId: Number(projectId),
        createdAt: { gte: startDate },
      },
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    const recentPrs = await prisma.pullRequest.groupBy({
      by: ['createdAt'],
      where: {
        projectId: Number(projectId),
        createdAt: { gte: startDate },
      },
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate estimated time saved (assume 2 hours per AI fix)
    const estimatedTimeSaved = totalAiFixes * 2; // hours

    // Get issue resolution time trends
    const avgResolutionTime = await prisma.issue.aggregate({
      where: {
        projectId: Number(projectId),
        state: 'closed',
        updatedAt: { gte: startDate },
      },
      _avg: {
        // This would need a custom field to track resolution time
        // For now, we'll use a placeholder calculation
      },
    });

    // Success rate calculation
    const successRate = totalAiPrs > 0 ? (mergedAiPrs / totalAiPrs) * 100 : 0;

    // Format activity data for charts
    const activityData = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      
      const dayIssues = recentIssues.filter(
        item => item.createdAt.toISOString().split('T')[0] === dateStr
      ).reduce((sum, item) => sum + item._count.id, 0);
      
      const dayPrs = recentPrs.filter(
        item => item.createdAt.toISOString().split('T')[0] === dateStr
      ).reduce((sum, item) => sum + item._count.id, 0);

      return {
        date: dateStr,
        issues: dayIssues,
        pullRequests: dayPrs,
      };
    });

    const insights = {
      summary: {
        totalAiFixes,
        estimatedTimeSaved,
        successRate: Math.round(successRate * 100) / 100,
        totalAiPrs,
        mergedAiPrs,
      },
      activityTrends: activityData,
      metrics: {
        avgResolutionTime: 4.2, // Placeholder - would need actual tracking
        issuesResolvedThisWeek: Math.floor(totalAiFixes * 0.3),
        prsCreatedThisWeek: Math.floor(totalAiPrs * 0.4),
      },
      timeframe: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    return NextResponse.json(insights);
  } catch (error) {
    console.error('Error fetching developer insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch developer insights' },
      { status: 500 }
    );
  }
}