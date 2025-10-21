/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/workspaces/route';
import { WorkspaceManager } from '@/lib/multi-repo/workspace-manager';
import { NextRequest } from 'next/server';

// Mock WorkspaceManager
jest.mock('@/lib/multi-repo/workspace-manager');

describe('/api/workspaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/workspaces', () => {
    it('should return 400 if userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/workspaces');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('User ID is required');
    });

    it('should return list of workspaces', async () => {
      const mockWorkspaces = [
        {
          id: 'ws-1',
          name: 'Workspace 1',
          description: 'First workspace',
          userId: 'user-123',
          organizationId: null,
          repositories: [],
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ws-2',
          name: 'Workspace 2',
          description: 'Second workspace',
          userId: 'user-123',
          organizationId: null,
          repositories: ['repo1'],
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        listWorkspaces: jest.fn().mockResolvedValue(mockWorkspaces),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces?userId=user-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].id).toBe('ws-1');
    });

    it('should handle errors gracefully', async () => {
      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        listWorkspaces: jest.fn().mockRejectedValue(new Error('Database error')),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces?userId=user-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Database error');
    });
  });

  describe('POST /api/workspaces', () => {
    it('should return 400 if userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Workspace',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('User ID is required');
    });

    it('should return 400 if name is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Name is required');
    });

    it('should create a workspace successfully', async () => {
      const mockWorkspace = {
        id: 'ws-new',
        name: 'New Workspace',
        description: 'Test description',
        userId: 'user-123',
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

      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        createWorkspace: jest.fn().mockResolvedValue(mockWorkspace),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-123',
          name: 'New Workspace',
          description: 'Test description',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('ws-new');
      expect(data.data.name).toBe('New Workspace');
    });

    it('should create workspace with custom settings', async () => {
      const customSettings = {
        autoSync: false,
        syncInterval: 7200000,
        includePrivate: false,
        includeArchived: true,
        defaultBranch: 'develop',
      };

      const mockWorkspace = {
        id: 'ws-custom',
        name: 'Custom Workspace',
        description: null,
        userId: 'user-123',
        organizationId: null,
        repositories: [],
        settings: customSettings,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        createWorkspace: jest.fn().mockResolvedValue(mockWorkspace),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-123',
          name: 'Custom Workspace',
          settings: customSettings,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.settings).toMatchObject(customSettings);
    });

    it('should handle creation errors', async () => {
      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        createWorkspace: jest.fn().mockRejectedValue(new Error('Creation failed')),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user-123',
          name: 'Test Workspace',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Creation failed');
    });
  });
});
