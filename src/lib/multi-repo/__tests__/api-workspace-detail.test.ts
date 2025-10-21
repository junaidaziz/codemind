/**
 * @jest-environment node
 */

import { GET, PUT, DELETE } from '@/app/api/workspaces/[workspaceId]/route';
import { WorkspaceManager } from '@/lib/multi-repo/workspace-manager';
import { NextRequest } from 'next/server';

// Mock WorkspaceManager
jest.mock('@/lib/multi-repo/workspace-manager');

describe('/api/workspaces/[workspaceId]', () => {
  const mockContext = {
    params: Promise.resolve({ workspaceId: 'ws-123' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/workspaces/[workspaceId]', () => {
    it('should return 400 if userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-123');

      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('User ID is required');
    });

    it('should return workspace by ID', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        description: 'Test description',
        userId: 'user-123',
        organizationId: null,
        repositories: ['repo1', 'repo2'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        getWorkspace: jest.fn().mockResolvedValue(mockWorkspace),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-123?userId=user-123');

      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('ws-123');
      expect(data.data.name).toBe('Test Workspace');
    });

    it('should return 404 if workspace not found', async () => {
      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        getWorkspace: jest.fn().mockResolvedValue(null),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-999?userId=user-123');

      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  describe('PUT /api/workspaces/[workspaceId]', () => {
    it('should return 400 if userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      });

      const response = await PUT(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('User ID is required');
    });

    it('should update workspace successfully', async () => {
      const updatedWorkspace = {
        id: 'ws-123',
        name: 'Updated Workspace',
        description: 'Updated description',
        userId: 'user-123',
        organizationId: null,
        repositories: [],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        updateWorkspace: jest.fn().mockResolvedValue({
          success: true,
          message: 'Workspace updated successfully',
          data: updatedWorkspace,
        }),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-123', {
        method: 'PUT',
        body: JSON.stringify({
          userId: 'user-123',
          name: 'Updated Workspace',
          description: 'Updated description',
        }),
      });

      const response = await PUT(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Workspace');
    });

    it('should update workspace settings', async () => {
      const mockManager = {
        updateWorkspace: jest.fn().mockResolvedValue({
          success: true,
          message: 'Workspace updated successfully',
          data: {
            id: 'ws-123',
            name: 'Test Workspace',
            description: null,
            userId: 'user-123',
            organizationId: null,
            repositories: [],
            settings: {
              autoSync: false,
              syncInterval: 7200000,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
      };

      (WorkspaceManager as jest.Mock).mockImplementation(() => mockManager);

      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-123', {
        method: 'PUT',
        body: JSON.stringify({
          userId: 'user-123',
          settings: {
            autoSync: false,
            syncInterval: 7200000,
          },
        }),
      });

      const response = await PUT(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockManager.updateWorkspace).toHaveBeenCalledWith('ws-123', {
        name: undefined,
        description: undefined,
        settings: {
          autoSync: false,
          syncInterval: 7200000,
        },
      });
    });

    it('should return 404 if workspace not found', async () => {
      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        updateWorkspace: jest.fn().mockResolvedValue({
          success: false,
          message: 'Workspace not found',
        }),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-999', {
        method: 'PUT',
        body: JSON.stringify({
          userId: 'user-123',
          name: 'Updated Name',
        }),
      });

      const response = await PUT(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /api/workspaces/[workspaceId]', () => {
    it('should return 400 if userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('User ID is required');
    });

    it('should delete workspace successfully', async () => {
      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        deleteWorkspace: jest.fn().mockResolvedValue({
          success: true,
          message: 'Workspace deleted successfully',
        }),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-123?userId=user-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted successfully');
    });

    it('should return 404 if workspace not found', async () => {
      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        deleteWorkspace: jest.fn().mockResolvedValue({
          success: false,
          message: 'Workspace not found',
        }),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-999?userId=user-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('should handle deletion errors', async () => {
      (WorkspaceManager as jest.Mock).mockImplementation(() => ({
        deleteWorkspace: jest.fn().mockRejectedValue(new Error('Deletion failed')),
      }));

      const request = new NextRequest('http://localhost:3000/api/workspaces/ws-123?userId=user-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Deletion failed');
    });
  });
});
