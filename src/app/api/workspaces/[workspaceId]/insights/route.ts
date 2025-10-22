import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-server';
import prisma from '@/app/lib/db';

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

interface ActivityEvent {
  id: string;
  eventType: string;
  title: string;
  description?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface RepositoryStats {
  owner: string;
  repo: string;
  commits: number;
  pullRequests: number;
  issues: number;
  contributors: number;
  lastActivity: string;
}

interface WorkspaceInsights {
  overview: {
    totalCommits: number;
    totalPullRequests: number;
    totalIssues: number;
    totalContributors: number;
    activeRepositories: number;
  };
  recentActivity: ActivityEvent[];
  repositoryStats: RepositoryStats[];
  topContributors: Array<{
    login: string;
    contributions: number;
    avatarUrl?: string;
  }>;
  activityTrend: Array<{
    date: string;
    commits: number;
    prs: number;
    issues: number;
  }>;
}

/**
 * GET /api/workspaces/[workspaceId]/insights
 * 
 * Fetch comprehensive insights for a workspace including:
 * - Overview metrics (commits, PRs, issues, contributors)
 * - Recent activity across all repositories
 * - Repository-level statistics
 * - Top contributors
 * - Activity trends over time
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { workspaceId } = await context.params;
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId: userId,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';
    
    // Parse time range
    const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Get repositories from workspace
    const repositories = (workspace.repositories as string[]) || [];

    if (repositories.length === 0) {
      return NextResponse.json({
        overview: {
          totalCommits: 0,
          totalPullRequests: 0,
          totalIssues: 0,
          totalContributors: 0,
          activeRepositories: 0,
        },
        recentActivity: [],
        repositoryStats: [],
        topContributors: [],
        activityTrend: [],
      });
    }

    // Find all projects that match workspace repositories
    const projects = await prisma.project.findMany({
      where: {
        ownerId: userId,
        OR: repositories.map((repo) => {
          const [owner, name] = repo.split('/');
          return {
            githubUrl: {
              contains: `${owner}/${name}`,
            },
          };
        }),
      },
      select: {
        id: true,
        name: true,
        githubUrl: true,
      },
    });

    const projectIds = projects.map((p) => p.id);

    // Fetch data in parallel
    const [pullRequests, issues, activityEvents] = await Promise.all([
      // Pull Requests
      prisma.pullRequest.findMany({
        where: {
          projectId: { in: projectIds },
          createdAt: { gte: sinceDate },
        },
        select: {
          id: true,
          number: true,
          title: true,
          state: true,
          createdAt: true,
          updatedAt: true,
          authorLogin: true,
          projectId: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // Issues
      prisma.issue.findMany({
        where: {
          projectId: { in: projectIds },
          createdAt: { gte: sinceDate },
        },
        select: {
          id: true,
          number: true,
          title: true,
          state: true,
          createdAt: true,
          authorLogin: true,
          projectId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Activity Events
      prisma.activityEvent.findMany({
        where: {
          projectId: { in: projectIds },
          createdAt: { gte: sinceDate },
        },
        select: {
          id: true,
          eventType: true,
          title: true,
          description: true,
          createdAt: true,
          metadata: true,
          projectId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Calculate overview metrics
    const overview = {
      totalCommits: activityEvents.filter((e) =>
        ['APR_CODE_GENERATION', 'APR_COMPLETED', 'INDEXING_COMPLETED'].includes(e.eventType)
      ).length,
      totalPullRequests: pullRequests.length,
      totalIssues: issues.length,
      totalContributors: new Set([
        ...pullRequests.map((pr) => pr.authorLogin),
        ...issues.map((issue) => issue.authorLogin),
      ].filter(Boolean)).size,
      activeRepositories: repositories.length,
    };

    // Format recent activity
    const recentActivity: ActivityEvent[] = [
      ...pullRequests.slice(0, 10).map((pr) => ({
        id: `pr-${pr.id}`,
        eventType: pr.state === 'MERGED' ? 'PR_MERGED' : 'PR_OPENED',
        title: pr.title,
        description: `Pull Request #${pr.number} - ${pr.state}`,
        createdAt: pr.updatedAt.toISOString(),
        metadata: { author: pr.authorLogin, projectId: pr.projectId },
      })),
      ...issues.slice(0, 10).map((issue) => ({
        id: `issue-${issue.id}`,
        eventType: issue.state === 'CLOSED' ? 'ISSUE_CLOSED' : 'ISSUE_OPENED',
        title: issue.title,
        description: `Issue #${issue.number} - ${issue.state}`,
        createdAt: issue.createdAt.toISOString(),
        metadata: { author: issue.authorLogin, projectId: issue.projectId },
      })),
      ...activityEvents.slice(0, 10).map((event) => ({
        id: event.id,
        eventType: event.eventType,
        title: event.title,
        description: event.description || undefined,
        createdAt: event.createdAt.toISOString(),
        metadata: event.metadata as Record<string, unknown> | undefined,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    // Calculate repository stats
    const repositoryStats: RepositoryStats[] = await Promise.all(
      repositories.map(async (repo) => {
        const [owner, name] = repo.split('/');
        const project = projects.find((p) => p.githubUrl?.includes(repo));

        if (!project) {
          return {
            owner,
            repo: name,
            commits: 0,
            pullRequests: 0,
            issues: 0,
            contributors: 0,
            lastActivity: new Date().toISOString(),
          };
        }

        const repoPRs = pullRequests.filter((pr) => pr.projectId === project.id);
        const repoIssues = issues.filter((issue) => issue.projectId === project.id);
        const repoEvents = activityEvents.filter((e) => e.projectId === project.id);

        const contributors = new Set([
          ...repoPRs.map((pr) => pr.authorLogin),
          ...repoIssues.map((issue) => issue.authorLogin),
        ].filter(Boolean));

        const lastActivity = [
          ...repoPRs.map((pr) => pr.updatedAt),
          ...repoIssues.map((issue) => issue.createdAt),
          ...repoEvents.map((e) => e.createdAt),
        ].sort((a, b) => b.getTime() - a.getTime())[0];

        return {
          owner,
          repo: name,
          commits: repoEvents.filter((e) =>
            ['APR_CODE_GENERATION', 'APR_COMPLETED'].includes(e.eventType)
          ).length,
          pullRequests: repoPRs.length,
          issues: repoIssues.length,
          contributors: contributors.size,
          lastActivity: lastActivity?.toISOString() || new Date().toISOString(),
        };
      })
    );

    // Calculate top contributors
    const contributorMap = new Map<string, number>();
    pullRequests.forEach((pr) => {
      if (pr.authorLogin) {
        contributorMap.set(pr.authorLogin, (contributorMap.get(pr.authorLogin) || 0) + 1);
      }
    });
    issues.forEach((issue) => {
      if (issue.authorLogin) {
        contributorMap.set(issue.authorLogin, (contributorMap.get(issue.authorLogin) || 0) + 1);
      }
    });

    const topContributors = Array.from(contributorMap.entries())
      .map(([login, contributions]) => ({
        login,
        contributions,
        avatarUrl: undefined, // TODO: Add avatar URL from GitHub API
      }))
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 10);

    // Calculate activity trend (last 7 days)
    const activityTrend = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayEvents = activityEvents.filter((e) => {
        const eventDate = new Date(e.createdAt);
        return eventDate >= date && eventDate < nextDate;
      });

      const dayPRs = pullRequests.filter((pr) => {
        const prDate = new Date(pr.createdAt);
        return prDate >= date && prDate < nextDate;
      });

      const dayIssues = issues.filter((issue) => {
        const issueDate = new Date(issue.createdAt);
        return issueDate >= date && issueDate < nextDate;
      });

      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        commits: dayEvents.filter((e) =>
          ['APR_CODE_GENERATION', 'APR_COMPLETED'].includes(e.eventType)
        ).length,
        prs: dayPRs.length,
        issues: dayIssues.length,
      };
    });

    const insights: WorkspaceInsights = {
      overview,
      recentActivity,
      repositoryStats,
      topContributors,
      activityTrend,
    };

    return NextResponse.json(insights);
  } catch (error) {
    console.error('Workspace insights API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch workspace insights',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
