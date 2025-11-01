import { CostBudgetService } from '../cost-budget-service';

// Mock Prisma
jest.mock('../../app/lib/db', () => ({
  __esModule: true,
  default: {
    costBudget: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import prisma from '../../app/lib/db';

describe('CostBudgetService', () => {
  let service: CostBudgetService;

  beforeEach(() => {
    service = new CostBudgetService();
    jest.clearAllMocks();
  });

  describe('setBudget', () => {
    it('creates a new budget when none exists', async () => {
      const mockBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        budgetType: 'monthly',
        limitUsd: 100,
        currentSpendUsd: 0,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        alertsEnabled: true,
        period: '2024-01',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
        lastAlertSent: null,
        lastAlertType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
        organizationId: null,
        userId: null,
      };

      (prisma.costBudget.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.costBudget.create as jest.Mock).mockResolvedValue(mockBudget);

      const result = await service.setBudget('project-1', 'monthly', {
        limitUsd: 100,
      });

      expect(result).toEqual({ id: 'budget-1', operation: 'create' });
      expect(prisma.costBudget.create).toHaveBeenCalled();
    });

    it('updates existing budget', async () => {
      const existingBudget = {
        id: 'budget-1',
        projectId: 'project-1',
        budgetType: 'monthly',
        limitUsd: 50,
        period: '2024-01',
        isActive: true,
      };

      const updatedBudget = { ...existingBudget, limitUsd: 100 };

      (prisma.costBudget.findFirst as jest.Mock).mockResolvedValue(existingBudget);
      (prisma.costBudget.update as jest.Mock).mockResolvedValue(updatedBudget);

      const result = await service.setBudget('project-1', 'monthly', {
        limitUsd: 100,
      });

      expect(result).toEqual({ id: 'budget-1', operation: 'update' });
      expect(prisma.costBudget.update).toHaveBeenCalled();
    });
  });

  describe('getBudgetStatus', () => {
    it('calculates budget status correctly', async () => {
      const mockBudget = {
        id: 'budget-1',
        budgetType: 'monthly',
        limitUsd: 100,
        currentSpendUsd: 50,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      };

      (prisma.costBudget.findMany as jest.Mock).mockResolvedValue([mockBudget]);

      const result = await service.getBudgetStatus('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].percentUsed).toBe(50);
      expect(result[0].remainingUsd).toBe(50);
      expect(result[0].status).toBe('ok');
    });

    it('identifies warning status when threshold is exceeded', async () => {
      const mockBudget = {
        id: 'budget-1',
        budgetType: 'monthly',
        limitUsd: 100,
        currentSpendUsd: 85,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      };

      (prisma.costBudget.findMany as jest.Mock).mockResolvedValue([mockBudget]);

      const result = await service.getBudgetStatus('project-1');

      expect(result[0].status).toBe('warning');
    });

    it('identifies exceeded status when limit is reached', async () => {
      const mockBudget = {
        id: 'budget-1',
        budgetType: 'monthly',
        limitUsd: 100,
        currentSpendUsd: 105,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      };

      (prisma.costBudget.findMany as jest.Mock).mockResolvedValue([mockBudget]);

      const result = await service.getBudgetStatus('project-1');

      expect(result[0].status).toBe('exceeded');
      expect(result[0].percentUsed).toBeGreaterThan(100);
    });
  });

  describe('getForecast', () => {
    it('calculates spending forecast correctly', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 10); // 10 days ago

      const mockBudget = {
        id: 'budget-1',
        budgetType: 'monthly',
        limitUsd: 100,
        currentSpendUsd: 30,
        startDate,
        endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
        isActive: true,
      };

      (prisma.costBudget.findFirst as jest.Mock).mockResolvedValue(mockBudget);

      const result = await service.getForecast('project-1', 'monthly');

      expect(result).not.toBeNull();
      expect(result!.currentSpend).toBe(30);
      expect(result!.averageDaily).toBe(3); // 30 / 10
      expect(result!.projectedTotal).toBeGreaterThanOrEqual(87); // Should be close to 3 * 29 days
      expect(result!.daysRemaining).toBeGreaterThan(0);
    });

    it('returns null when no budget exists', async () => {
      (prisma.costBudget.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getForecast('project-1', 'monthly');

      expect(result).toBeNull();
    });
  });

  describe('isWithinBudget', () => {
    it('returns true when all budgets are within limits', async () => {
      const mockBudget = {
        id: 'budget-1',
        budgetType: 'monthly',
        limitUsd: 100,
        currentSpendUsd: 50,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      };

      (prisma.costBudget.findMany as jest.Mock).mockResolvedValue([mockBudget]);

      const result = await service.isWithinBudget('project-1');

      expect(result).toBe(true);
    });

    it('returns false when any budget is exceeded', async () => {
      const mockBudget = {
        id: 'budget-1',
        budgetType: 'monthly',
        limitUsd: 100,
        currentSpendUsd: 105,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      };

      (prisma.costBudget.findMany as jest.Mock).mockResolvedValue([mockBudget]);

      const result = await service.isWithinBudget('project-1');

      expect(result).toBe(false);
    });
  });

  describe('updateBudgetSpend', () => {
    it('updates budget spend for active budgets', async () => {
      const mockBudget = {
        id: 'budget-1',
        currentSpendUsd: 50,
        limitUsd: 100,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
        alertsEnabled: true,
      };

      (prisma.costBudget.findMany as jest.Mock).mockResolvedValue([mockBudget]);
      (prisma.costBudget.update as jest.Mock).mockResolvedValue({
        ...mockBudget,
        currentSpendUsd: 55,
      });

      await service.updateBudgetSpend('project-1', 5);

      expect(prisma.costBudget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: { currentSpendUsd: 55 },
      });
    });

    it('expires old budgets', async () => {
      const mockBudget = {
        id: 'budget-1',
        currentSpendUsd: 50,
        limitUsd: 100,
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        isActive: true,
      };

      (prisma.costBudget.findMany as jest.Mock).mockResolvedValue([mockBudget]);
      (prisma.costBudget.update as jest.Mock).mockResolvedValue({
        ...mockBudget,
        isActive: false,
      });

      await service.updateBudgetSpend('project-1', 5);

      expect(prisma.costBudget.update).toHaveBeenCalledWith({
        where: { id: 'budget-1' },
        data: { isActive: false },
      });
    });
  });
});
