import { NextRequest, NextResponse } from 'next/server';
import { costBudgetService } from '@/lib/cost-budget-service';
import { logger } from '@/app/lib/logger';

/**
 * Get spending forecast for a project
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const budgetType = searchParams.get('budgetType') as 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    if (!budgetType) {
      return NextResponse.json(
        { error: 'budgetType is required' },
        { status: 400 }
      );
    }

    const forecast = await costBudgetService.getForecast(projectId, budgetType);

    if (!forecast) {
      return NextResponse.json(
        { error: 'No active budget found for this project' },
        { status: 404 }
      );
    }

    return NextResponse.json(forecast);
  } catch (error) {
    logger.error('Error fetching forecast', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch forecast' },
      { status: 500 }
    );
  }
}
