import { NextRequest, NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { GitHubService } from "@/lib/github-service";
import { getRealTimeAnalyticsService } from "@/lib/realtime-analytics";
import { CacheService } from "@/lib/cache-service";
import { getGitHubToken } from "@/lib/config-helper";
// TODO: Add authentication when auth system is configured
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '../../../../auth/[...nextauth]/route';

interface SyncParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: SyncParams) {
  const { id } = await params;
  try {
    // TODO: Add authentication when auth system is configured
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Verify project exists (TODO: Add user access verification when auth is configured)
    const project = await prisma.project.findFirst({
      where: {
        id: id
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse GitHub URL to get owner and repo
    const githubUrl = project.githubUrl;
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    
    if (!match) {
      return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    // Get GitHub token from project configuration
    const githubToken = await getGitHubToken(id);
    
    if (!githubToken) {
      return NextResponse.json({ 
        error: 'GitHub access token not configured for this project. Please configure GitHub credentials in project settings.' 
      }, { status: 400 });
    }

    const githubService = new GitHubService(githubToken);
    
    const body = await request.json();
    const { syncCommits = true, syncPullRequests = true, syncIssues = true, syncContributors = true, since } = body;

    const results: {
      commits?: { successful: number; failed: number; total: number };
      contributors?: { successful: number; failed: number; total: number };
      pullRequests?: { successful: number; failed: number; total: number };
      issues?: { successful: number; failed: number; total: number };
    } = {};
    const sinceDate = since ? new Date(since) : undefined;

    try {
      // Sync commits if requested
      if (syncCommits) {
        results.commits = await githubService.syncCommits(id, owner, cleanRepo, sinceDate);
      }

      // Sync contributors if requested
      if (syncContributors) {
        results.contributors = await githubService.syncContributors(id, owner, cleanRepo);
      }

      // Sync pull requests if requested
      if (syncPullRequests) {
        results.pullRequests = await githubService.syncPullRequests(id, owner, cleanRepo);
      }

      // Sync issues if requested
      if (syncIssues) {
        results.issues = await githubService.syncIssues(id, owner, cleanRepo);
      }

      // Update project's last indexed timestamp
      await prisma.project.update({
        where: { id: id },
        data: { 
          lastIndexedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Invalidate cache and notify real-time service
      await CacheService.markProjectAsUpdated(id);
      const realTimeService = getRealTimeAnalyticsService();
      await realTimeService.notifyGitHubSyncComplete(id, results);

      return NextResponse.json({
        success: true,
        message: 'GitHub data synchronized successfully',
        results,
        timestamp: new Date().toISOString()
      });

    } catch (syncError) {
      console.error('GitHub sync error:', syncError);
      return NextResponse.json({
        success: false,
        error: 'Failed to synchronize some GitHub data',
        results,
        details: syncError instanceof Error ? syncError.message : 'Unknown error'
      }, { status: 207 }); // 207 Multi-Status for partial success
    }

  } catch (error) {
    console.error('GitHub sync API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to sync GitHub data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: SyncParams) {
  const { id } = await params;
  try {
    // TODO: Add authentication when auth system is configured
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Get sync status for the project (TODO: Add user access verification when auth is configured)
    const project = await prisma.project.findFirst({
      where: {
        id: id
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get counts manually for now since _count is having schema issues  
    // Note: Using hardcoded counts until schema relationships are fixed
    const contributorCount = 0;
    const pullRequestCount = 0;
    const issueCount = 0;

    return NextResponse.json({
      projectId: project.id,
      lastIndexedAt: project.lastIndexedAt,
      githubUrl: project.githubUrl,
      counts: {
        contributors: contributorCount,
        pullRequests: pullRequestCount,
        issues: issueCount,
        commits: 0 // Will be added when commits model is properly linked
      },
      isStale: project.lastIndexedAt ? 
        (Date.now() - project.lastIndexedAt.getTime()) > 24 * 60 * 60 * 1000 : // 24 hours
        true
    });

  } catch (error) {
    console.error('GitHub sync status API error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' }, 
      { status: 500 }
    );
  }
}