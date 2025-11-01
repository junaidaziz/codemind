import { NextRequest, NextResponse } from 'next/server';
import { costBudgetService } from '@/lib/cost-budget-service';
import { logger } from '@/app/lib/logger';
import { z } from 'zod';

const budgetSchema = z.object({
  projectId: z.string(),
  budgetType: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'total']),
  limitUsd: z.number().positive(),
  warningThreshold: z.number().min(0).max(1).optional(),
  criticalThreshold: z.number().min(0).max(1).optional(),
  alertsEnabled: z.boolean().optional(),
});

/**
 * Create or update a budget
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = budgetSchema.parse(body);

    const result = await costBudgetService.setBudget(
      data.projectId,
      data.budgetType,
      {
        limitUsd: data.limitUsd,
        warningThreshold: data.warningThreshold,
        criticalThreshold: data.criticalThreshold,
        alertsEnabled: data.alertsEnabled,
      }
    );

    // Return appropriate status code based on operation
    const statusCode = result.operation === 'create' ? 201 : 200;
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating budget', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to create budget' },
      { status: 500 }
    );
  }
}

/**
 * Get budgets for a project
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const budgets = await costBudgetService.getBudgetStatus(projectId);

    return NextResponse.json({ budgets });
  } catch (error) {
    logger.error('Error fetching budgets', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch budgets' },
      { status: 500 }
    );
  }
}

/**
 * Delete a budget
 */
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const budgetId = searchParams.get('budgetId');

    if (!budgetId) {
      return NextResponse.json(
        { error: 'budgetId is required' },
        { status: 400 }
      );
    }

    await costBudgetService.deleteBudget(budgetId);

    return NextResponse.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    logger.error('Error deleting budget', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to delete budget' },
      { status: 500 }
    );
  }
}
