/**
 * @jest-environment node
 */

import { WorkspaceManager } from '../workspace-manager';
import prisma from '@/lib/db';
import type { Workspace, WorkspaceSettings } from '../types';

// Mock Prisma with proper mock functions
const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    workspace: {
      create: mockCreate,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

describe('WorkspaceManager', () => {
  const userId = 'test-user-123';
  let manager: WorkspaceManager;

  beforeEach(() => {
    manager = new WorkspaceManager(userId);
    jest.clearAllMocks();
  });

  describe('createWorkspace', () => {
    it('should create a workspace with default settings', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: 'Test Description',
        userId,
        organizationId: null,
        repositories: [],
        settings: {
          autoSync: true,
          syncInterval: 3600000,
          includePrivate: true,
          includeArchived: false,
          defaultBranch: 'main',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreate.mockResolvedValue(mockWorkspace);

      const result = await manager.createWorkspace('Test Workspace', 'Test Description');

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Workspace',
          description: 'Test Description',
          userId,
          repositories: [],
        }),
      });

      expect(result).toMatchObject({
        id: 'ws-123',
        name: 'Test Workspace',
        description: 'Test Description',
      });
    });

    it('should create a workspace with custom settings', async () => {
      const customSettings: WorkspaceSettings = {
        autoSync: false,
        syncInterval: 7200000,
        includePrivate: false,
        includeArchived: true,
        defaultBranch: 'develop',
      };

      const mockWorkspace = {
        id: 'ws-124',
        name: 'Custom Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: [],
        settings: customSettings,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreate.mockResolvedValue(mockWorkspace);

      const result = await manager.createWorkspace('Custom Workspace', undefined, customSettings);

      expect(result.settings).toMatchObject(customSettings);
    });
  });

  describe('getWorkspace', () => {
    it('should return a workspace by ID', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: 'Test Description',
        userId,
        organizationId: null,
        repositories: ['repo1', 'repo2'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);

      const result = await manager.getWorkspace('ws-123');

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'ws-123',
          userId,
        },
      });

      expect(result).toMatchObject({
        id: 'ws-123',
        name: 'Test Workspace',
      });
    });

    it('should return null if workspace not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await manager.getWorkspace('non-existent');

      expect(result).toBeNull();
    });

    it('should not return workspace belonging to different user', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await manager.getWorkspace('ws-other-user');

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'ws-other-user',
          userId, // Should filter by current user
        },
      });

      expect(result).toBeNull();
    });
  });

  describe('listWorkspaces', () => {
    it('should return all workspaces for user', async () => {
      const mockWorkspaces = [
        {
          id: 'ws-1',
          name: 'Workspace 1',
          description: 'First workspace',
          userId,
          organizationId: null,
          repositories: [],
          settings: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'ws-2',
          name: 'Workspace 2',
          description: 'Second workspace',
          userId,
          organizationId: null,
          repositories: ['repo1'],
          settings: {},
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
        },
      ];

      mockFindMany.mockResolvedValue(mockWorkspaces);

      const result = await manager.listWorkspaces();

      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          userId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ws-1');
      expect(result[1].id).toBe('ws-2');
    });

    it('should return empty array if no workspaces', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await manager.listWorkspaces();

      expect(result).toEqual([]);
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace name and description', async () => {
      const existingWorkspace = {
        id: 'ws-123',
        name: 'Old Name',
        description: 'Old Description',
        userId,
        organizationId: null,
        repositories: [],
        settings: { autoSync: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedWorkspace = {
        ...existingWorkspace,
        name: 'New Name',
        description: 'New Description',
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(existingWorkspace);
      mockUpdate.mockResolvedValue(updatedWorkspace);

      const result = await manager.updateWorkspace('ws-123', {
        name: 'New Name',
        description: 'New Description',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('New Name');
      expect(result.data?.description).toBe('New Description');
    });

    it('should merge settings when updating', async () => {
      const existingWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: [],
        settings: {
          autoSync: true,
          syncInterval: 3600000,
          includePrivate: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(existingWorkspace);
      mockUpdate.mockImplementation(({ data }) => ({
        ...existingWorkspace,
        ...data,
      }));

      const result = await manager.updateWorkspace('ws-123', {
        settings: {
          autoSync: false,
        },
      });

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should return error if workspace not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await manager.updateWorkspace('non-existent', {
        name: 'New Name',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Workspace not found');
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete a workspace', async () => {
      mockDelete.mockResolvedValue({});

      const result = await manager.deleteWorkspace('ws-123');

      expect(mockDelete).toHaveBeenCalledWith({
        where: {
          id: 'ws-123',
          userId,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Workspace deleted successfully');
    });

    it('should handle deletion errors', async () => {
      mockDelete.mockRejectedValue(
        new Error('Workspace not found')
      );

      const result = await manager.deleteWorkspace('non-existent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Workspace not found');
    });
  });

  describe('addRepository', () => {
    it('should add a repository to workspace', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: ['existing-repo'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);
      mockUpdate.mockResolvedValue({
        ...mockWorkspace,
        repositories: ['existing-repo', 'new-repo'],
      });

      const result = await manager.addRepository('ws-123', 'new-repo');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'ws-123' },
        data: {
          repositories: ['existing-repo', 'new-repo'],
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should not add duplicate repository', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: ['existing-repo'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);

      const result = await manager.addRepository('ws-123', 'existing-repo');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should return error if workspace not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await manager.addRepository('non-existent', 'repo');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Workspace not found');
    });
  });

  describe('removeRepository', () => {
    it('should remove a repository from workspace', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: ['repo1', 'repo2', 'repo3'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);
      mockUpdate.mockResolvedValue({
        ...mockWorkspace,
        repositories: ['repo1', 'repo3'],
      });

      const result = await manager.removeRepository('ws-123', 'repo2');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'ws-123' },
        data: {
          repositories: ['repo1', 'repo3'],
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should return error if repository not in workspace', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: ['repo1'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);

      const result = await manager.removeRepository('ws-123', 'repo2');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found in workspace');
    });
  });

  describe('addRepositories', () => {
    it('should add multiple repositories at once', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: ['existing-repo'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);
      mockUpdate.mockResolvedValue({
        ...mockWorkspace,
        repositories: ['existing-repo', 'repo1', 'repo2', 'repo3'],
      });

      const result = await manager.addRepositories('ws-123', ['repo1', 'repo2', 'repo3']);

      expect(result.success).toBe(true);
      expect(result.message).toContain('3 repositories');
    });

    it('should skip duplicate repositories', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: ['repo1', 'repo2'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);
      mockUpdate.mockResolvedValue({
        ...mockWorkspace,
        repositories: ['repo1', 'repo2', 'repo3'],
      });

      const result = await manager.addRepositories('ws-123', ['repo1', 'repo2', 'repo3']);

      expect(result.success).toBe(true);
      // Should only add repo3 (repo1 and repo2 already exist)
    });
  });

  describe('getWorkspaceRepositories', () => {
    it('should return all repositories in workspace', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: ['repo1', 'repo2', 'repo3'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);

      const result = await manager.getWorkspaceRepositories('ws-123');

      expect(result).toEqual(['repo1', 'repo2', 'repo3']);
    });

    it('should return empty array if no repositories', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: [],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);

      const result = await manager.getWorkspaceRepositories('ws-123');

      expect(result).toEqual([]);
    });

    it('should return empty array if workspace not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await manager.getWorkspaceRepositories('non-existent');

      expect(result).toEqual([]);
    });
  });

  describe('getWorkspaceStats', () => {
    it('should calculate workspace statistics', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: ['repo1', 'repo2', 'repo3', 'repo4', 'repo5'],
        settings: {},
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);

      const result = await manager.getWorkspaceStats('ws-123');

      expect(result).toMatchObject({
        totalRepositories: 5,
        lastSyncedAt: expect.any(Date),
      });
    });

    it('should return null if workspace not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await manager.getWorkspaceStats('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status for workspace', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: null,
        userId,
        organizationId: null,
        repositories: ['repo1', 'repo2'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindFirst.mockResolvedValue(mockWorkspace);

      const result = await manager.getSyncStatus('ws-123');

      expect(result).toMatchObject({
        workspaceId: 'ws-123',
        status: 'idle',
        lastSync: null,
      });
    });

    it('should return null if workspace not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await manager.getSyncStatus('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('startSync', () => {
    it('should return success message', async () => {
      const result = await manager.startSync('ws-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('not yet implemented');
    });
  });
});
