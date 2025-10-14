/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import prisma from "../../../../../lib/db";
// TODO: Add authentication when auth system is configured
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '../../../../../auth/[...nextauth]/route';

interface ContributorParams {
  params: Promise<{
    id: string;
    username: string;
  }>;
}

export async function GET(request: NextRequest, { params }: ContributorParams) {
  const { id, username } = await params;
  try {
    // TODO: Add authentication when auth system is configured
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '30d';

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

    // Verify project exists (TODO: Add user access verification when auth is configured)
    const project = await prisma.project.findFirst({
      where: {
        id: id
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find the contributor
    const contributor = await prisma.contributor.findFirst({
      where: {
        projectId: id,
        username: username
      },
      include: {
        commits: {
          where: {
            date: { gte: startDate }
          },
          orderBy: { date: 'desc' },
          take: 50
        },
        pullRequests: {
          where: {
            createdAt: { gte: startDate }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!contributor) {
      return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
    }

    // Calculate activity trends (group by day)
    const activityMap = new Map<string, {
      date: string;
      commits: number;
      additions: number;
      deletions: number;
    }>();

    // Initialize all days in range
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      activityMap.set(dateKey, {
        date: dateKey,
        commits: 0,
        additions: 0,
        deletions: 0
      });
    }

    // Count commits per day
    contributor.commits.forEach((commit: any) => {
      const dateKey = commit.date.toISOString().split('T')[0];
      const activity = activityMap.get(dateKey);
      if (activity) {
        activity.commits++;
        activity.additions += commit.additions || 0;
        activity.deletions += commit.deletions || 0;
      }
    });

    const activityTrend = Array.from(activityMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate top files
    const fileMap = new Map<string, {
      filename: string;
      commits: number;
      additions: number;
      deletions: number;
    }>();

    contributor.commits.forEach((commit: any) => {
      commit.filesChanged.forEach((filename: string) => {
        const existing = fileMap.get(filename) || {
          filename,
          commits: 0,
          additions: 0,
          deletions: 0
        };
        
        existing.commits++;
        existing.additions += commit.additions || 0;
        existing.deletions += commit.deletions || 0;
        
        fileMap.set(filename, existing);
      });
    });

    const topFiles = Array.from(fileMap.values())
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 20);

    // Format the response
    const contributorDetail = {
      id: contributor.id,
      username: contributor.username,
      githubId: contributor.githubId,
      avatarUrl: contributor.avatarUrl,
      email: contributor.email,
      name: contributor.name,
      totalCommits: contributor.totalCommits,
      totalAdditions: contributor.totalAdditions,
      totalDeletions: contributor.totalDeletions,
      totalPRs: contributor.totalPRs,
      lastActiveAt: contributor.lastActiveAt?.toISOString(),
      joinedAt: contributor.joinedAt.toISOString(),
      commits: contributor.commits.map((commit: any) => ({
        id: commit.id,
        sha: commit.sha,
        message: commit.message,
        date: commit.date.toISOString(),
        additions: commit.additions,
        deletions: commit.deletions,
        filesChanged: commit.filesChanged,
        url: commit.url
      })),
      pullRequests: contributor.pullRequests.map((pr: any) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        createdAt: pr.createdAt.toISOString(),
        mergedAt: pr.mergedAt?.toISOString(),
        url: pr.htmlUrl
      })),
      activityTrend,
      topFiles,
      timeframe,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    };

    return NextResponse.json(contributorDetail);

  } catch (error) {
    console.error('Contributor detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributor details' }, 
      { status: 500 }
    );
  }
}