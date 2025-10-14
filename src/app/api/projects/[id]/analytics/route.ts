import { NextRequest, NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { CacheService } from '@/lib/cache-service';
// TODO: Add authentication when auth system is configured
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '../../../auth/[...nextauth]/route';

interface AnalyticsParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: AnalyticsParams) {
  const { id } = await params;
  try {
    // TODO: Add authentication when auth system is configured
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '30d';
    const useCache = searchParams.get('cache') !== 'false'; // Default to using cache
    const branch = searchParams.get('branch');
    const search = searchParams.get('search');
    const contributors = searchParams.get('contributors')?.split(',').filter(Boolean) || [];

    // Check cache first if enabled (only cache when no filters are applied)
    const hasFilters = branch || search || contributors.length > 0;
    if (useCache && !hasFilters) {
      const cacheKey = `analytics:project:${id}:${timeframe}`;
      const cachedData = await CacheService.get(cacheKey);
      if (cachedData) {
        return NextResponse.json({
          ...cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Calculate date range based on timeframe
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build filter conditions for pull requests and issues
    const prFilters = {
      createdAt: { gte: startDate },
      ...(contributors.length > 0 && { authorLogin: { in: contributors } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { body: { contains: search, mode: 'insensitive' as const } },
          { authorLogin: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    };

    const issueFilters = {
      createdAt: { gte: startDate },
      ...(contributors.length > 0 && { authorLogin: { in: contributors } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { body: { contains: search, mode: 'insensitive' as const } },
          { authorLogin: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    };

    // Verify project exists (TODO: Add user access verification when auth is configured)
    const project = await prisma.project.findFirst({
      where: {
        id: id
      },
      include: {
        pullRequests: {
          where: prFilters,
          orderBy: { createdAt: 'desc' }
        },
        issues: {
          where: issueFilters,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build filter conditions for commits
    const commitFilters = {
      projectId: id,
      date: { gte: startDate },
      ...(contributors.length > 0 && { author: { in: contributors } }),
      ...(search && {
        OR: [
          { message: { contains: search, mode: 'insensitive' as const } },
          { author: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    };

    // Fetch commits and contributors separately
    const commits = await prisma.commit.findMany({
      where: commitFilters,
      orderBy: { date: 'desc' }
    });

    const contributorFilters = {
      projectId: id,
      ...(contributors.length > 0 && { username: { in: contributors } }),
      ...(search && { 
        username: { contains: search, mode: 'insensitive' as const } 
      })
    };

    const contributorsData = await prisma.contributor.findMany({
      where: contributorFilters,
      orderBy: { totalCommits: 'desc' }
    });

    // Calculate summary metrics
    const totalCommits = commits.length;
    const totalContributors = contributorsData.length;
    const totalPullRequests = project.pullRequests.length;
    const totalIssues = project.issues.length;

    const openPullRequests = project.pullRequests.filter(pr => pr.state === 'OPEN').length;
    const mergedPullRequests = project.pullRequests.filter(pr => pr.state === 'MERGED').length;
    const openIssues = project.issues.filter(issue => issue.state === 'OPEN').length;
    const closedIssues = project.issues.filter(issue => issue.state === 'CLOSED').length;

    // Calculate activity trends (group by day)
    const activityMap = new Map<string, {
      date: string;
      commits: number;
      pullRequests: number;
      issues: number;
    }>();

    // Initialize all days in range
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      activityMap.set(dateKey, {
        date: dateKey,
        commits: 0,
        pullRequests: 0,
        issues: 0
      });
    }

    // Count commits per day
    commits.forEach(commit => {
      const dateKey = commit.date.toISOString().split('T')[0];
      const activity = activityMap.get(dateKey);
      if (activity) {
        activity.commits++;
      }
    });

    // Count PRs per day
    project.pullRequests.forEach(pr => {
      const dateKey = pr.createdAt.toISOString().split('T')[0];
      const activity = activityMap.get(dateKey);
      if (activity) {
        activity.pullRequests++;
      }
    });

    // Count issues per day
    project.issues.forEach(issue => {
      const dateKey = issue.createdAt.toISOString().split('T')[0];
      const activity = activityMap.get(dateKey);
      if (activity) {
        activity.issues++;
      }
    });

    const activityTrends = Array.from(activityMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate contributor insights
    // Fetch AI metrics for the project
    const aiMetrics = await prisma.autoFixMetrics.findMany({
      where: {
        projectId: id,
        periodStart: { gte: startDate }
      },
      orderBy: { periodStart: 'desc' }
    });

    // Calculate AI metrics summary
    const totalAIFixes = aiMetrics.reduce((sum, m) => sum + m.totalIssuesFixed, 0);
    const totalAISessions = aiMetrics.reduce((sum, m) => sum + m.totalSessions, 0);
    const successfulAISessions = aiMetrics.reduce((sum, m) => sum + m.successfulSessions, 0);
    const aiGeneratedPRs = aiMetrics.reduce((sum, m) => sum + m.totalPRsCreated, 0);
    const aiMergedPRs = aiMetrics.reduce((sum, m) => sum + m.totalPRsMerged, 0);

    const aiSuccessRate = totalAISessions > 0 ? (successfulAISessions / totalAISessions * 100) : 0;
    const aiPRAcceptanceRate = aiGeneratedPRs > 0 ? (aiMergedPRs / aiGeneratedPRs * 100) : 0;

    // Calculate average confidence and processing time
    const aiMetricsWithValues = aiMetrics.filter(m => m.avgConfidence && m.avgProcessingTime);
    const avgAIConfidence = aiMetricsWithValues.length > 0 
      ? aiMetricsWithValues.reduce((sum, m) => sum + (m.avgConfidence || 0), 0) / aiMetricsWithValues.length 
      : 0;
    const avgProcessingTime = aiMetricsWithValues.length > 0 
      ? aiMetricsWithValues.reduce((sum, m) => sum + (m.avgProcessingTime || 0), 0) / aiMetricsWithValues.length 
      : 0;

    // AI activity over time
    const aiActivityTrends = aiMetrics.map(metric => ({
      date: metric.periodStart.toISOString().split('T')[0],
      fixes: metric.totalIssuesFixed,
      sessionsStarted: metric.totalSessions,
      successfulSessions: metric.successfulSessions,
      prsCreated: metric.totalPRsCreated,
      prsMerged: metric.totalPRsMerged,
      confidence: metric.avgConfidence || 0
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const contributorStats = contributorsData.map(contributor => {
      const contributorCommits = commits.filter(
        commit => commit.author === contributor.username
      ).length;

      const contributorPRs = project.pullRequests.filter(
        pr => pr.authorLogin === contributor.username
      ).length;

      return {
        login: contributor.username,
        avatarUrl: contributor.avatarUrl,
        htmlUrl: `https://github.com/${contributor.username}`,
        totalContributions: contributor.totalCommits,
        commitsInPeriod: contributorCommits,
        pullRequestsInPeriod: contributorPRs,
        lastActivity: commits
          .filter(commit => commit.author === contributor.username)
          .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.date || null
      };
    });

    // Calculate code changes over time
    const codeChanges = commits.map(commit => ({
      date: commit.date.toISOString().split('T')[0],
      additions: commit.additions || 0,
      deletions: commit.deletions || 0,
      netChanges: (commit.additions || 0) - (commit.deletions || 0)
    }));

    // Group code changes by day
    const codeChangesMap = new Map<string, {
      date: string;
      additions: number;
      deletions: number;
      netChanges: number;
    }>();

    codeChanges.forEach(change => {
      const existing = codeChangesMap.get(change.date) || {
        date: change.date,
        additions: 0,
        deletions: 0,
        netChanges: 0
      };
      
      existing.additions += change.additions;
      existing.deletions += change.deletions;
      existing.netChanges += change.netChanges;
      
      codeChangesMap.set(change.date, existing);
    });

    const codeChangesOverTime = Array.from(codeChangesMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate pull request metrics
    const prMetrics = {
      averageTimeToMerge: calculateAverageTimeToMerge(project.pullRequests.filter(pr => pr.state === 'MERGED')),
      mergeRate: totalPullRequests > 0 ? (mergedPullRequests / totalPullRequests * 100) : 0,
      reviewTurnaround: calculateReviewTurnaround(project.pullRequests)
    };

    const analytics = {
      summary: {
        totalCommits,
        totalContributors,
        totalPullRequests,
        totalIssues,
        openPullRequests,
        mergedPullRequests,
        openIssues,
        closedIssues,
        // AI Metrics Summary
        totalAIFixes,
        totalAISessions,
        aiSuccessRate,
        aiPRAcceptanceRate,
        avgAIConfidence,
        avgProcessingTime: avgProcessingTime / 1000, // Convert to seconds
        timeframe,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        // Filter information
        filters: {
          branch: branch || null,
          search: search || null,
          contributors: contributors.length > 0 ? contributors : null,
          hasFilters
        }
      },
      activityTrends,
      contributors: contributorStats.slice(0, 10), // Top 10 contributors
      codeChangesOverTime,
      pullRequestMetrics: prMetrics,
      // AI Metrics
      aiMetrics: {
        summary: {
          totalFixes: totalAIFixes,
          totalSessions: totalAISessions,
          successfulSessions: successfulAISessions,
          successRate: aiSuccessRate,
          avgConfidence: avgAIConfidence,
          avgProcessingTime: avgProcessingTime / 1000, // Convert to seconds
          prsCreated: aiGeneratedPRs,
          prsMerged: aiMergedPRs,
          prAcceptanceRate: aiPRAcceptanceRate
        },
        trends: aiActivityTrends,
        recentMetrics: aiMetrics.slice(0, 10)
      },
      recentCommits: commits.slice(0, 20),
      recentPullRequests: project.pullRequests.slice(0, 10),
      recentIssues: project.issues.slice(0, 10),
      cached: false,
      timestamp: new Date().toISOString()
    };

    // Cache the analytics data if caching is enabled and no filters applied
    if (useCache && !hasFilters) {
      const cacheKey = `analytics:project:${id}:${timeframe}`;
      const cacheTtl = timeframe === '7d' ? 180 : timeframe === '30d' ? 300 : 600; // Shorter cache for recent data
      await CacheService.set(cacheKey, analytics, cacheTtl);
    }

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' }, 
      { status: 500 }
    );
  }
}

function calculateAverageTimeToMerge(mergedPRs: { mergedAt: Date | null; createdAt: Date }[]): number {
  if (mergedPRs.length === 0) return 0;
  
  const totalTime = mergedPRs.reduce((acc, pr) => {
    if (pr.mergedAt && pr.createdAt) {
      return acc + (new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime());
    }
    return acc;
  }, 0);
  
  return totalTime / mergedPRs.length / (1000 * 60 * 60 * 24); // Convert to days
}

function calculateReviewTurnaround(pullRequests: { updatedAt: Date; createdAt: Date }[]): number {
  // Simplified calculation - in real implementation, you'd fetch PR reviews
  // For now, return average time from creation to first update
  const prsWithUpdates = pullRequests.filter(pr => 
    pr.updatedAt && pr.createdAt && pr.updatedAt > pr.createdAt
  );
  
  if (prsWithUpdates.length === 0) return 0;
  
  const totalTime = prsWithUpdates.reduce((acc, pr) => {
    return acc + (new Date(pr.updatedAt).getTime() - new Date(pr.createdAt).getTime());
  }, 0);
  
  return totalTime / prsWithUpdates.length / (1000 * 60 * 60); // Convert to hours
}