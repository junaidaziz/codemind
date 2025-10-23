import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const whereClause: {
      projectId: string;
      createdAt?: { gte: Date; lte: Date };
    } = { projectId };

    if (startDateStr && endDateStr) {
      whereClause.createdAt = {
        gte: new Date(startDateStr),
        lte: new Date(endDateStr),
      };
    }

    // Get all usage data
    const usage = await prisma.aIModelUsage.findMany({
      where: whereClause,
      select: {
        modelName: true,
        provider: true,
        totalTokens: true,
        costUsd: true,
        durationMs: true,
        success: true,
      },
    });

    // Group by model
    const modelStats: Record<
      string,
      {
        model: string;
        provider: string;
        totalRequests: number;
        successfulRequests: number;
        totalCost: number;
        totalTokens: number;
        totalDuration: number;
        avgCostPerRequest: number;
        avgTokensPerRequest: number;
        avgDurationMs: number;
        successRate: number;
      }
    > = {};

    usage.forEach((record) => {
      if (!modelStats[record.modelName]) {
        modelStats[record.modelName] = {
          model: record.modelName,
          provider: record.provider,
          totalRequests: 0,
          successfulRequests: 0,
          totalCost: 0,
          totalTokens: 0,
          totalDuration: 0,
          avgCostPerRequest: 0,
          avgTokensPerRequest: 0,
          avgDurationMs: 0,
          successRate: 0,
        };
      }

      const stats = modelStats[record.modelName];
      stats.totalRequests += 1;
      if (record.success) stats.successfulRequests += 1;
      stats.totalCost += record.costUsd;
      stats.totalTokens += record.totalTokens;
      stats.totalDuration += record.durationMs || 0;
    });

    // Calculate averages
    const models = Object.values(modelStats).map((stats) => ({
      ...stats,
      avgCostPerRequest: stats.totalCost / stats.totalRequests,
      avgTokensPerRequest: stats.totalTokens / stats.totalRequests,
      avgDurationMs: stats.totalDuration / stats.totalRequests,
      successRate: (stats.successfulRequests / stats.totalRequests) * 100,
    }));

    // Sort by total cost descending
    models.sort((a, b) => b.totalCost - a.totalCost);

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching model performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}
