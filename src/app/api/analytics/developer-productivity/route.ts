import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface DeveloperMetrics {
  userId: string;
  name: string;
  email: string;
  prsCreated: number;
  prsReviewed: number;
  commentsGiven: number;
  commentsReceived: number;
  averageReviewTime: number;
  averagePrSize: number;
  approvalRate: number;
  weeklyActivity: Array<{
    week: string;
    prs: number;
    reviews: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all users who have activity in the period
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Get code reviews data
    const codeReviews = await prisma.codeReview.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        authorLogin: true,
        status: true,
        linesAdded: true,
        linesRemoved: true,
        createdAt: true,
        completedAt: true,
        approved: true,
        requiresChanges: true,
      },
    });

    // Get all comments
    const allComments = await prisma.codeReviewComment.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        reviewId: true,
        aiGenerated: true,
        CodeReview: {
          select: {
            authorLogin: true,
          },
        },
      },
    });

    // Calculate metrics for each developer
    const developerMetrics: DeveloperMetrics[] = users
      .map((user: { id: string; name: string | null; email: string | null }) => {
        const githubLogin = user.email?.split('@')[0] || user.name || '';
        
        const prsCreated = codeReviews.filter((cr) => cr.authorLogin === githubLogin);
        // Since we don't have a reviewer field, we'll estimate from comment activity
        const reviewedPrs = new Set<string>();
        allComments
          .filter((c) => !c.aiGenerated && c.CodeReview.authorLogin !== githubLogin)
          .forEach((c) => reviewedPrs.add(c.reviewId));
        const prsReviewed = Array.from(reviewedPrs);
        
        const commentsGiven = allComments.filter(
          (c) => !c.aiGenerated && c.CodeReview.authorLogin !== githubLogin
        ).length;
        const commentsReceived = allComments.filter(
          (c) => c.CodeReview.authorLogin === githubLogin
        ).length;

        // Calculate average review time (in hours)
        const reviewTimes = prsCreated
          .filter((cr) => cr.completedAt)
          .map((cr) => {
            const created = new Date(cr.createdAt).getTime();
            const completed = new Date(cr.completedAt!).getTime();
            return (completed - created) / (1000 * 60 * 60); // Convert to hours
          });

        const averageReviewTime =
          reviewTimes.length > 0
            ? reviewTimes.reduce((a: number, b: number) => a + b, 0) / reviewTimes.length
            : 0;

        // Calculate average PR size (lines changed)
        const prSizes = prsCreated.map((cr) => (cr.linesAdded || 0) + (cr.linesRemoved || 0));
        const averagePrSize =
          prSizes.length > 0 ? prSizes.reduce((a: number, b: number) => a + b, 0) / prSizes.length : 0;

        // Calculate approval rate
        const approvedPrs = prsCreated.filter((cr) => cr.approved);
        const approvalRate =
          prsCreated.length > 0 ? (approvedPrs.length / prsCreated.length) * 100 : 0;

        // Calculate weekly activity
        const weeks = Math.ceil(days / 7);
        const weeklyActivity = [];
        for (let i = 0; i < weeks; i++) {
          const weekStart = new Date(startDate);
          weekStart.setDate(weekStart.getDate() + i * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          const weekPrs = prsCreated.filter((cr) => {
            const created = new Date(cr.createdAt);
            return created >= weekStart && created < weekEnd;
          });

          const weekReviews = prsReviewed.filter((reviewId) => {
            const review = codeReviews.find((cr) => cr.id === reviewId);
            if (!review) return false;
            const completed = review.completedAt ? new Date(review.completedAt) : null;
            return completed && completed >= weekStart && completed < weekEnd;
          });

          weeklyActivity.push({
            week: `Week ${i + 1}`,
            prs: weekPrs.length,
            reviews: weekReviews.length,
          });
        }

        return {
          userId: user.id,
          name: user.name || 'Unknown',
          email: user.email || '',
          prsCreated: prsCreated.length,
          prsReviewed: prsReviewed.length,
          commentsGiven,
          commentsReceived,
          averageReviewTime,
          averagePrSize,
          approvalRate,
          weeklyActivity,
        };
      })
      .filter(
        (dev: DeveloperMetrics) =>
          dev.prsCreated > 0 || dev.prsReviewed > 0 || dev.commentsGiven > 0
      ); // Only include active developers

    // Calculate team averages
    const teamAverages = {
      prsCreated:
        developerMetrics.length > 0
          ? developerMetrics.reduce((sum, dev) => sum + dev.prsCreated, 0) /
            developerMetrics.length
          : 0,
      prsReviewed:
        developerMetrics.length > 0
          ? developerMetrics.reduce((sum, dev) => sum + dev.prsReviewed, 0) /
            developerMetrics.length
          : 0,
      reviewTime:
        developerMetrics.length > 0
          ? developerMetrics.reduce((sum, dev) => sum + dev.averageReviewTime, 0) /
            developerMetrics.length
          : 0,
      prSize:
        developerMetrics.length > 0
          ? developerMetrics.reduce((sum, dev) => sum + dev.averagePrSize, 0) /
            developerMetrics.length
          : 0,
      approvalRate:
        developerMetrics.length > 0
          ? developerMetrics.reduce((sum, dev) => sum + dev.approvalRate, 0) /
            developerMetrics.length
          : 0,
    };

    return NextResponse.json({
      developers: developerMetrics,
      teamAverages,
    });
  } catch (error) {
    console.error('Error fetching developer productivity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch developer productivity data' },
      { status: 500 }
    );
  }
}
