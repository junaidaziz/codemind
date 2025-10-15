/**
 * @jest-environment node
 */

// Mock Prisma client
jest.mock('@/app/lib/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

import { GET } from '../route';
import db from '@/app/lib/db';

// Get reference to the mocked function
const mockQueryRaw = db.$queryRaw as jest.MockedFunction<typeof db.$queryRaw>;

describe('/api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns healthy status when database is connected', async () => {
      // Mock successful database query
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.services.database).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it('returns unhealthy status when database is disconnected', async () => {
      // Mock database connection failure
      mockQueryRaw.mockRejectedValue(new Error('Connection refused'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.services.database).toBe('unhealthy');
      expect(data.timestamp).toBeDefined();
      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it('includes system metrics in response', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(data.system).toBeDefined();
      expect(data.system.memory).toBeDefined();
      expect(data.system.memory.used).toBeGreaterThan(0);
      expect(data.system.memory.total).toBeGreaterThan(0);
      expect(data.system.cpu).toBeDefined();
      expect(data.system.cpu.usage).toBeDefined();
    });

    it('includes environment information', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(data.environment).toBeDefined();
      expect(data.version).toBeDefined();
    });

    it('handles database timeout errors gracefully', async () => {
      // Mock database timeout
      mockQueryRaw.mockRejectedValue(new Error('Query timeout'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.services.database).toBe('unhealthy');
    });

    it('handles unexpected errors in health check', async () => {
      // Mock unexpected error during health check
      // This simulates an error that's caught and handled by checkDatabase
      mockQueryRaw.mockRejectedValue(new Error('Unexpected error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.services.database).toBe('unhealthy');
    });

    it('returns proper HTTP status codes', async () => {
      // Healthy case
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
      let response = await GET();
      expect(response.status).toBe(200);

      // Unhealthy case
      mockQueryRaw.mockRejectedValue(new Error('DB error'));
      response = await GET();
      expect(response.status).toBe(503);
    });

    it('checks all service statuses', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(data.services).toBeDefined();
      expect(data.services.database).toBeDefined();
      expect(data.services.openai).toBeDefined();
      expect(data.services.redis).toBeDefined();
    });
  });

  describe('Database Health Check', () => {
    it('logs database errors to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockQueryRaw.mockRejectedValue(new Error('Database connection failed'));

      await GET();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database health check failed'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('continues health check even if database fails', async () => {
      mockQueryRaw.mockRejectedValue(new Error('DB error'));

      const response = await GET();
      const data = await response.json();

      // Should still return a response with status and timestamp
      expect(data.status).toBe('unhealthy');
      expect(data.timestamp).toBeDefined();
      expect(data.services).toBeDefined();
    });
  });
});
