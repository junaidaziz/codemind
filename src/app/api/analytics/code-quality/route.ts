import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { CodeReview, CodeReviewComment } from '@prisma/client';

interface QualityTrend {
  date: string;
  avgRiskScore: number;
  avgOverallScore: number;
  totalReviews: number;
  highRiskCount: number;
  criticalIssues: number;
  avgLinesChanged: number;
}

interface IssueTrend {
  category: string;
  count: number;
  trend: number;
}

type ReviewWithComments = CodeReview & {
  CodeReviewComment: CodeReviewComment[];
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const previousStartDate = new Date();
    previousStartDate.setDate(previousStartDate.getDate() - (days * 2));
    previousStartDate.setTime(previousStartDate.getTime() - (startDate.getTime() - previousStartDate.getTime()));

    // Fetch reviews for current period
    const currentReviews = await prisma.codeReview.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        CodeReviewComment: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Fetch reviews for previous period (for comparison)
    const previousReviews = await prisma.codeReview.findMany({
      where: {
        createdAt: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
      include: {
        CodeReviewComment: true,
      },
    });

    // Group current reviews by date
    const reviewsByDate = new Map<string, ReviewWithComments[]>();
    currentReviews.forEach((review: ReviewWithComments) => {
      const dateKey = review.createdAt.toISOString().split('T')[0];
      if (!reviewsByDate.has(dateKey)) {
        reviewsByDate.set(dateKey, []);
      }
      reviewsByDate.get(dateKey)!.push(review);
    });

    // Calculate daily trends
    const trends: QualityTrend[] = [];
    const sortedDates = Array.from(reviewsByDate.keys()).sort();

    sortedDates.forEach((date) => {
      const reviews = reviewsByDate.get(date)!;
      const totalReviews = reviews.length;
      
      if (totalReviews === 0) return;

      const avgRiskScore = reviews.reduce((sum: number, r: ReviewWithComments) => sum + r.riskScore, 0) / totalReviews;
      const avgOverallScore = reviews.reduce((sum: number, r: ReviewWithComments) => sum + r.overallScore, 0) / totalReviews;
      const highRiskCount = reviews.filter((r: ReviewWithComments) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;
      const criticalIssues = reviews.reduce(
        (sum: number, r: ReviewWithComments) => sum + r.CodeReviewComment.filter((c: CodeReviewComment) => c.severity === 'ERROR' || c.severity === 'CRITICAL').length,
        0
      );
      const avgLinesChanged = reviews.reduce((sum: number, r: ReviewWithComments) => sum + r.linesAdded + r.linesRemoved, 0) / totalReviews;

      trends.push({
        date,
        avgRiskScore: Number(avgRiskScore.toFixed(2)),
        avgOverallScore: Number(avgOverallScore.toFixed(2)),
        totalReviews,
        highRiskCount,
        criticalIssues,
        avgLinesChanged: Number(avgLinesChanged.toFixed(0)),
      });
    });

    // Fill in missing dates with zero values
    const allDates: string[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      allDates.push(date.toISOString().split('T')[0]);
    }

    const completeTrends: QualityTrend[] = allDates.map((date) => {
      const existing = trends.find((t) => t.date === date);
      return (
        existing || {
          date,
          avgRiskScore: 0,
          avgOverallScore: 0,
          totalReviews: 0,
          highRiskCount: 0,
          criticalIssues: 0,
          avgLinesChanged: 0,
        }
      );
    });

    // Calculate issues by category
    const issuesByCategory = new Map<string, number>();
    const previousIssuesByCategory = new Map<string, number>();

    currentReviews.forEach((review: ReviewWithComments) => {
      review.CodeReviewComment.forEach((comment: CodeReviewComment) => {
        const category = comment.category;
        issuesByCategory.set(category, (issuesByCategory.get(category) || 0) + 1);
      });
    });

    previousReviews.forEach((review: ReviewWithComments) => {
      review.CodeReviewComment.forEach((comment: CodeReviewComment) => {
        const category = comment.category;
        previousIssuesByCategory.set(category, (previousIssuesByCategory.get(category) || 0) + 1);
      });
    });

    const issuesByCategoryArray: IssueTrend[] = Array.from(issuesByCategory.entries())
      .map(([category, count]) => {
        const previousCount = previousIssuesByCategory.get(category) || 0;
        const trend = previousCount > 0 ? ((count - previousCount) / previousCount) * 100 : 0;
        return {
          category,
          count,
          trend: Number(trend.toFixed(1)),
        };
      })
      .sort((a, b) => b.count - a.count);

    // Calculate summary metrics
    const totalReviews = currentReviews.length;
    const avgRiskScore = totalReviews > 0
      ? currentReviews.reduce((sum: number, r: ReviewWithComments) => sum + r.riskScore, 0) / totalReviews
      : 0;
    const avgOverallScore = totalReviews > 0
      ? currentReviews.reduce((sum: number, r: ReviewWithComments) => sum + r.overallScore, 0) / totalReviews
      : 0;

    const previousTotalReviews = previousReviews.length;
    const previousAvgRiskScore = previousTotalReviews > 0
      ? previousReviews.reduce((sum: number, r: ReviewWithComments) => sum + r.riskScore, 0) / previousTotalReviews
      : 0;
    const previousAvgOverallScore = previousTotalReviews > 0
      ? previousReviews.reduce((sum: number, r: ReviewWithComments) => sum + r.overallScore, 0) / previousTotalReviews
      : 0;

    const riskScoreChange = previousAvgRiskScore > 0
      ? ((avgRiskScore - previousAvgRiskScore) / previousAvgRiskScore) * 100
      : 0;
    const overallScoreChange = previousAvgOverallScore > 0
      ? ((avgOverallScore - previousAvgOverallScore) / previousAvgOverallScore) * 100
      : 0;

    // Calculate top improvements
    const topImprovements = [
      {
        metric: 'Risk Score',
        change: -riskScoreChange, // Negative risk score change is good
        unit: 'lower',
      },
      {
        metric: 'Quality Score',
        change: overallScoreChange,
        unit: 'higher',
      },
    ]
      .filter((i) => Math.abs(i.change) > 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 3);

    return NextResponse.json({
      trends: completeTrends,
      issuesByCategory: issuesByCategoryArray,
      topImprovements,
      summary: {
        avgRiskScore: Number(avgRiskScore.toFixed(2)),
        avgOverallScore: Number(avgOverallScore.toFixed(2)),
        totalReviews,
        riskScoreChange: Number(riskScoreChange.toFixed(1)),
        overallScoreChange: Number(overallScoreChange.toFixed(1)),
      },
    });
  } catch (error) {
    console.error('Error fetching code quality metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch code quality metrics' },
      { status: 500 }
    );
  }
}
