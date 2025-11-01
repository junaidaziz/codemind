import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface TimeRange {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}

function getTimeRange(range: '7d' | '30d' | '90d'): TimeRange {
  const end = new Date();
  const start = new Date();
  
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  start.setDate(end.getDate() - days);
  
  // Previous period for comparison
  const previousEnd = new Date(start);
  const previousStart = new Date(start);
  previousStart.setDate(previousEnd.getDate() - days);
  
  return { start, end, previousStart, previousEnd };
}

export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication when auth system is configured
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const searchParams = request.nextUrl.searchParams;
    const range = (searchParams.get('range') || '30d') as '7d' | '30d' | '90d';
    const projectId = searchParams.get('projectId');

    const { start, end, previousStart, previousEnd } = getTimeRange(range);

    // Build project filter
    const projectFilter = projectId ? { projectId } : {};

    // Fetch pull requests for current period
    const pullRequests = await prisma.pullRequest.findMany({
      where: {
        ...projectFilter,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        Project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Fetch pull requests for previous period (for trends)
    const previousPullRequests = await prisma.pullRequest.findMany({
      where: {
        ...projectFilter,
        createdAt: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
    });

    // Fetch activity logs for review comments
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        ...projectFilter,
        activityType: 'CODE_REVIEWED',
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Fetch code review results for quality metrics
    const codeReviews = await prisma.codeReview.findMany({
      where: {
        ...projectFilter,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        prNumber: true,
        riskScore: true,
        approved: true,
        createdAt: true,
        updatedAt: true,
        CodeReviewComment: {
          select: {
            severity: true,
          },
        },
      },
    });

    // Calculate overall metrics
    const totalPRs = pullRequests.length;
    const previousTotalPRs = previousPullRequests.length;
    
    const avgReviewTurnaround = pullRequests.length > 0
      ? pullRequests.reduce((sum: number, pr: typeof pullRequests[0]) => {
          const reviewTime = (pr.updatedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60);
          return sum + reviewTime;
        }, 0) / pullRequests.length
      : 0;

    const previousAvgReviewTurnaround = previousPullRequests.length > 0
      ? previousPullRequests.reduce((sum: number, pr: typeof previousPullRequests[0]) => {
          const reviewTime = (pr.updatedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60);
          return sum + reviewTime;
        }, 0) / previousPullRequests.length
      : 0;

    const approvedReviews = codeReviews.filter((r: typeof codeReviews[0]) => r.approved).length;
    const avgApprovalRate = codeReviews.length > 0 ? (approvedReviews / codeReviews.length) * 100 : 0;

    // Calculate previous period approval rate
    const previousCodeReviews = await prisma.codeReview.findMany({
      where: {
        ...projectFilter,
        createdAt: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
      select: {
        approved: true,
      },
    });

    const previousApprovedReviews = previousCodeReviews.filter((r: typeof previousCodeReviews[0]) => r.approved).length;
    const previousAvgApprovalRate = previousCodeReviews.length > 0
      ? (previousApprovedReviews / previousCodeReviews.length) * 100
      : 0;

    // Get unique reviewers (users who performed code reviews)
    const reviewers = new Set(activityLogs.filter((log: typeof activityLogs[0]) => log.userId).map((log: typeof activityLogs[0]) => log.userId));
    const totalReviewers = reviewers.size;

    const activePRs = await prisma.pullRequest.count({
      where: {
        ...projectFilter,
        state: 'OPEN',
      },
    });

    // Calculate trends
    const throughputChange = previousTotalPRs > 0
      ? ((totalPRs - previousTotalPRs) / previousTotalPRs) * 100
      : 0;

    const reviewTimeChange = previousAvgReviewTurnaround > 0
      ? ((avgReviewTurnaround - previousAvgReviewTurnaround) / previousAvgReviewTurnaround) * 100
      : 0;

    const approvalRateChange = previousAvgApprovalRate > 0
      ? ((avgApprovalRate - previousAvgApprovalRate) / previousAvgApprovalRate) * 100
      : 0;

    // Generate timeline data (daily buckets)
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const bucketSize = days > 30 ? 7 : 1; // Weekly for 90d, daily otherwise
    const numBuckets = Math.ceil(days / bucketSize);
    
    const timeline = Array.from({ length: numBuckets }, (_, i) => {
      const bucketEnd = new Date(end);
      bucketEnd.setDate(end.getDate() - (i * bucketSize));
      const bucketStart = new Date(bucketEnd);
      bucketStart.setDate(bucketEnd.getDate() - bucketSize);

      const bucketPRs = pullRequests.filter(
        (pr: typeof pullRequests[0]) => pr.createdAt >= bucketStart && pr.createdAt < bucketEnd
      );

      const bucketReviews = codeReviews.filter(
        (r: typeof codeReviews[0]) => r.createdAt >= bucketStart && r.createdAt < bucketEnd
      );

      const avgReviewTime = bucketPRs.length > 0
        ? bucketPRs.reduce((sum: number, pr: typeof bucketPRs[0]) => {
            const reviewTime = (pr.updatedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60);
            return sum + reviewTime;
          }, 0) / bucketPRs.length
        : 0;

      const approvalRate = bucketReviews.length > 0
        ? (bucketReviews.filter((r: typeof bucketReviews[0]) => r.approved).length / bucketReviews.length) * 100
        : 0;

      return {
        date: bucketStart.toISOString(),
        prs: bucketPRs.length,
        avgReviewTime,
        approvalRate,
      };
    }).reverse();

    // Calculate per-member metrics
    const memberMetrics = await Promise.all(
      Array.from(reviewers).map(async (userId) => {
        const user = await prisma.user.findUnique({
          where: { id: userId! },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        });

        if (!user) return null;

        const userLogs = activityLogs.filter((log: typeof activityLogs[0]) => log.userId === userId);
        const prsReviewed = new Set(userLogs.map((log: typeof userLogs[0]) => log.entityId)).size;

        // Calculate average review time for this user
        const userPRs = pullRequests.filter((pr: typeof pullRequests[0]) =>
          userLogs.some((log: typeof userLogs[0]) => log.entityId === pr.id)
        );

        const avgReviewTime = userPRs.length > 0
          ? userPRs.reduce((sum: number, pr: typeof userPRs[0]) => {
              const reviewTime = (pr.updatedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60);
              return sum + reviewTime;
            }, 0) / userPRs.length
          : 0;

        // Calculate average response time (time from PR creation to first review action)
        const avgResponseTime = userLogs.length > 0
          ? userLogs.reduce((sum: number, log: typeof userLogs[0]) => {
              const pr = pullRequests.find((p: typeof pullRequests[0]) => p.id === log.entityId);
              if (pr) {
                const responseTime = (log.createdAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60);
                return sum + (responseTime > 0 ? responseTime : 0);
              }
              return sum;
            }, 0) / userLogs.length
          : 0;

        // Get reviews this user participated in
        const userReviews = codeReviews.filter((r: typeof codeReviews[0]) => {
          const prId = pullRequests.find((pr: typeof pullRequests[0]) => pr.number === r.prNumber)?.id;
          return prId && userLogs.some((log: typeof userLogs[0]) => log.entityId === prId);
        });

        const userApprovalRate = userReviews.length > 0
          ? (userReviews.filter((r: typeof userReviews[0]) => r.approved).length / userReviews.length) * 100
          : 0;

        // Count critical issues found
        const criticalIssuesFound = userReviews.reduce((sum: number, review: typeof userReviews[0]) => {
          const criticalComments = review.CodeReviewComment.filter((c: typeof review.CodeReviewComment[0]) => c.severity === 'CRITICAL');
          return sum + criticalComments.length;
        }, 0);

        return {
          userId: user.id,
          name: user.name || 'Unknown',
          email: user.email || '',
          image: user.image,
          metrics: {
            prsReviewed,
            avgReviewTime,
            approvalRate: userApprovalRate,
            commentsGiven: userLogs.length,
            criticalIssuesFound,
            avgResponseTime,
          },
        };
      })
    );

    const validMembers = memberMetrics.filter(m => m !== null);

    return NextResponse.json({
      overall: {
        totalPRs,
        avgReviewTurnaround,
        avgApprovalRate,
        totalReviewers,
        activePRs,
      },
      timeline,
      members: validMembers,
      trends: {
        reviewTimeChange,
        approvalRateChange,
        throughputChange,
      },
    });
  } catch (error) {
    console.error('Failed to fetch team performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team performance metrics' },
      { status: 500 }
    );
  }
}
