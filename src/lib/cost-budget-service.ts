import prisma from '../app/lib/db';
import { logger } from '../app/lib/logger';

export type BudgetType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';
export type AlertType = 'warning' | 'critical' | 'exceeded';

export interface BudgetConfig {
  limitUsd: number;
  warningThreshold?: number; // Default 0.8 (80%)
  criticalThreshold?: number; // Default 0.95 (95%)
  alertsEnabled?: boolean;
}

export interface BudgetStatus {
  id: string;
  budgetType: BudgetType;
  limitUsd: number;
  currentSpendUsd: number;
  percentUsed: number;
  remainingUsd: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
  daysRemaining?: number;
  projectedEndDate?: Date;
  estimatedOverage?: number;
}

export class CostBudgetService {
  /**
   * Create or update a budget for a project
   */
  async setBudget(
    projectId: string,
    budgetType: BudgetType,
    config: BudgetConfig
  ): Promise<{ id: string; status: string }> {
    try {
      const period = this.getPeriodString(budgetType);
      const endDate = this.getEndDate(budgetType);

      // Check if budget already exists for this period
      const existing = await prisma.costBudget.findFirst({
        where: {
          projectId,
          budgetType,
          period,
          isActive: true,
        },
      });

      let budget;
      if (existing) {
        // Update existing budget
        budget = await prisma.costBudget.update({
          where: { id: existing.id },
          data: {
            limitUsd: config.limitUsd,
            warningThreshold: config.warningThreshold ?? 0.8,
            criticalThreshold: config.criticalThreshold ?? 0.95,
            alertsEnabled: config.alertsEnabled ?? true,
            endDate,
          },
        });
      } else {
        // Create new budget
        budget = await prisma.costBudget.create({
          data: {
            projectId,
            budgetType,
            limitUsd: config.limitUsd,
            warningThreshold: config.warningThreshold ?? 0.8,
            criticalThreshold: config.criticalThreshold ?? 0.95,
            alertsEnabled: config.alertsEnabled ?? true,
            period,
            endDate,
          },
        });
      }

      logger.info('Budget configured', {
        budgetId: budget.id,
        projectId,
        budgetType,
        limitUsd: config.limitUsd,
      });

      return { id: budget.id, status: 'created' };
    } catch (error) {
      logger.error('Failed to set budget', { projectId, budgetType }, error as Error);
      throw error;
    }
  }

  /**
   * Update current spend for a budget based on AI model usage
   */
  async updateBudgetSpend(projectId: string, costUsd: number): Promise<void> {
    try {
      // Get all active budgets for this project
      const budgets = await prisma.costBudget.findMany({
        where: {
          projectId,
          isActive: true,
        },
      });

      for (const budget of budgets) {
        // Check if this budget period is still valid
        if (budget.endDate && budget.endDate < new Date()) {
          // Expire old budget
          await prisma.costBudget.update({
            where: { id: budget.id },
            data: { isActive: false },
          });
          continue;
        }

        // Update current spend
        const newSpend = budget.currentSpendUsd + costUsd;
        await prisma.costBudget.update({
          where: { id: budget.id },
          data: { currentSpendUsd: newSpend },
        });

        // Check for threshold alerts
        await this.checkBudgetAlerts(budget.id, newSpend, budget.limitUsd);
      }
    } catch (error) {
      logger.error('Failed to update budget spend', { projectId, costUsd }, error as Error);
      // Don't throw - budget tracking failures shouldn't break main flow
    }
  }

  /**
   * Get budget status for a project
   */
  async getBudgetStatus(projectId: string): Promise<BudgetStatus[]> {
    const budgets = await prisma.costBudget.findMany({
      where: {
        projectId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return budgets.map((budget) => this.calculateBudgetStatus(budget));
  }

  /**
   * Get all budgets for a project (including inactive)
   */
  async getAllBudgets(projectId: string) {
    return await prisma.costBudget.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Check if spending is within budget
   */
  async isWithinBudget(projectId: string): Promise<boolean> {
    const statuses = await this.getBudgetStatus(projectId);
    return statuses.every((status) => status.status !== 'exceeded');
  }

  /**
   * Get forecasted spending based on current usage trends
   */
  async getForecast(projectId: string, budgetType: BudgetType): Promise<{
    currentSpend: number;
    averageDaily: number;
    projectedTotal: number;
    projectedOverage: number;
    daysRemaining: number;
  } | null> {
    try {
      const period = this.getPeriodString(budgetType);
      const budget = await prisma.costBudget.findFirst({
        where: {
          projectId,
          budgetType,
          period,
          isActive: true,
        },
      });

      if (!budget) return null;

      // Calculate days elapsed in current period
      const now = new Date();
      const startDate = budget.startDate;
      const daysElapsed = Math.max(
        1,
        Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Calculate average daily spend
      const averageDaily = budget.currentSpendUsd / daysElapsed;

      // Calculate days remaining in period
      const endDate = budget.endDate || this.getEndDate(budgetType);
      const daysRemaining = Math.floor(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Project total spend
      const totalDays = daysElapsed + daysRemaining;
      const projectedTotal = averageDaily * totalDays;
      const projectedOverage = Math.max(0, projectedTotal - budget.limitUsd);

      return {
        currentSpend: budget.currentSpendUsd,
        averageDaily,
        projectedTotal,
        projectedOverage,
        daysRemaining,
      };
    } catch (error) {
      logger.error('Failed to get forecast', { projectId, budgetType }, error as Error);
      return null;
    }
  }

  /**
   * Delete a budget
   */
  async deleteBudget(budgetId: string): Promise<void> {
    await prisma.costBudget.delete({
      where: { id: budgetId },
    });
  }

  /**
   * Deactivate a budget
   */
  async deactivateBudget(budgetId: string): Promise<void> {
    await prisma.costBudget.update({
      where: { id: budgetId },
      data: { isActive: false },
    });
  }

  // Private helper methods

  private calculateBudgetStatus(budget: {
    id: string;
    budgetType: string;
    limitUsd: number;
    currentSpendUsd: number;
    warningThreshold: number;
    criticalThreshold: number;
    startDate: Date;
    endDate: Date | null;
  }): BudgetStatus {
    const percentUsed = (budget.currentSpendUsd / budget.limitUsd) * 100;
    const remainingUsd = budget.limitUsd - budget.currentSpendUsd;

    let status: 'ok' | 'warning' | 'critical' | 'exceeded' = 'ok';
    if (percentUsed >= 100) {
      status = 'exceeded';
    } else if (percentUsed >= budget.criticalThreshold * 100) {
      status = 'critical';
    } else if (percentUsed >= budget.warningThreshold * 100) {
      status = 'warning';
    }

    const result: BudgetStatus = {
      id: budget.id,
      budgetType: budget.budgetType as BudgetType,
      limitUsd: budget.limitUsd,
      currentSpendUsd: budget.currentSpendUsd,
      percentUsed,
      remainingUsd,
      status,
    };

    // Calculate days remaining
    if (budget.endDate) {
      const now = new Date();
      const daysRemaining = Math.floor(
        (budget.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      result.daysRemaining = Math.max(0, daysRemaining);
      result.projectedEndDate = budget.endDate;

      // Estimate overage if trend continues
      if (daysRemaining > 0) {
        const daysElapsed = Math.max(
          1,
          Math.floor((now.getTime() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        const averageDaily = budget.currentSpendUsd / daysElapsed;
        const projectedTotal = averageDaily * (daysElapsed + daysRemaining);
        result.estimatedOverage = Math.max(0, projectedTotal - budget.limitUsd);
      }
    }

    return result;
  }

  private async checkBudgetAlerts(
    budgetId: string,
    currentSpend: number,
    limitUsd: number
  ): Promise<void> {
    try {
      const budget = await prisma.costBudget.findUnique({
        where: { id: budgetId },
      });

      if (!budget || !budget.alertsEnabled) return;

      const percentUsed = (currentSpend / limitUsd) * 100;
      let alertType: AlertType | null = null;

      if (percentUsed >= 100) {
        alertType = 'exceeded';
      } else if (percentUsed >= budget.criticalThreshold * 100) {
        alertType = 'critical';
      } else if (percentUsed >= budget.warningThreshold * 100) {
        alertType = 'warning';
      }

      // Only send alert if:
      // 1. We have an alert to send
      // 2. This is a new alert type OR enough time has passed since last alert
      if (alertType && this.shouldSendAlert(budget, alertType)) {
        await this.sendBudgetAlert(budget, alertType, percentUsed);
        
        // Update last alert info
        await prisma.costBudget.update({
          where: { id: budgetId },
          data: {
            lastAlertSent: new Date(),
            lastAlertType: alertType,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to check budget alerts', { budgetId }, error as Error);
    }
  }

  private shouldSendAlert(
    budget: {
      lastAlertSent: Date | null;
      lastAlertType: string | null;
    },
    alertType: AlertType
  ): boolean {
    // If no alert sent yet, send it
    if (!budget.lastAlertSent || !budget.lastAlertType) return true;

    // If alert type is more severe, send it
    const severityOrder = { warning: 1, critical: 2, exceeded: 3 };
    if (
      severityOrder[alertType] > severityOrder[budget.lastAlertType as AlertType]
    ) {
      return true;
    }

    // If same alert type, only send if 24 hours have passed
    const hoursSinceLastAlert =
      (Date.now() - budget.lastAlertSent.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastAlert >= 24;
  }

  private async sendBudgetAlert(
    budget: {
      id: string;
      projectId: string | null;
      budgetType: string;
      limitUsd: number;
      currentSpendUsd: number;
    },
    alertType: AlertType,
    percentUsed: number
  ): Promise<void> {
    logger.warn('Budget alert triggered', {
      budgetId: budget.id,
      projectId: budget.projectId,
      alertType,
      percentUsed,
      currentSpend: budget.currentSpendUsd,
      limit: budget.limitUsd,
    });

    // TODO: Implement actual alert mechanism (email, webhook, etc.)
    // For now, just log it
  }

  private getPeriodString(budgetType: BudgetType): string {
    const now = new Date();
    switch (budgetType) {
      case 'daily':
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
      case 'weekly':
        const year = now.getFullYear();
        const week = this.getWeekNumber(now);
        return `${year}-W${week.toString().padStart(2, '0')}`;
      case 'monthly':
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      case 'yearly':
        return now.getFullYear().toString();
      case 'total':
        return 'lifetime';
      default:
        return 'unknown';
    }
  }

  private getEndDate(budgetType: BudgetType): Date {
    const now = new Date();
    switch (budgetType) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case 'weekly':
        const daysUntilSunday = 7 - now.getDay();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      case 'yearly':
        return new Date(now.getFullYear() + 1, 0, 1);
      case 'total':
        // 100 years in the future
        return new Date(now.getFullYear() + 100, 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}

export const costBudgetService = new CostBudgetService();
