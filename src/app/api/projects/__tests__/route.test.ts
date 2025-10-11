import { GET, POST } from '../route';

// Mock Prisma
const mockProject = {
  id: 'test-project-id',
  name: 'Test Project',
  status: 'active',
  lastIndexedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  githubUrl: 'https://github.com/test/repo',
  ownerId: 'test-user-id',
};

const mockPrisma = {
  project: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@/lib/db', () => mockPrisma);

describe('/api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    it('returns projects successfully', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toMatchObject({
        id: mockProject.id,
        name: mockProject.name,
        status: mockProject.status,
      });
    });

    it('returns empty array when no projects exist', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(0);
    });

    it('handles database errors', async () => {
      mockPrisma.project.findMany.mockRejectedValue(new Error('Database error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('orders projects by creation date descending', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);

      await GET();

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          status: true,
          lastIndexedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('POST /api/projects', () => {
    const validProjectData = {
      name: 'New Project',
      githubUrl: 'https://github.com/test/new-repo',
    };

    it('creates project successfully', async () => {
      mockPrisma.project.create.mockResolvedValue({
        ...mockProject,
        ...validProjectData,
        id: 'new-project-id',
      });

      const request = new Request('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(validProjectData.name);
    });

    it('validates required fields', async () => {
      const invalidData = {
        githubUrl: 'https://github.com/test/repo',
        // Missing name field
      };

      const request = new Request('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles malformed JSON', async () => {
      const request = new Request('http://localhost:3000/api/projects', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('creates project with static user id', async () => {
      mockPrisma.project.create.mockResolvedValue({
        ...mockProject,
        ...validProjectData,
      });

      const request = new Request('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      await POST(request);

      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: {
          name: validProjectData.name,
          githubUrl: validProjectData.githubUrl,
          ownerId: 'static-user-id',
        },
      });
    });

    it('handles database creation errors', async () => {
      mockPrisma.project.create.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('CREATE_ERROR');
    });
  });

  describe('API Response Format', () => {
    it('follows consistent success response format', async () => {
      mockPrisma.project.findMany.mockResolvedValue([mockProject]);

      const response = await GET();
      const data = await response.json();

      expect(data).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
      expect(data.error).toBeUndefined();
    });

    it('follows consistent error response format', async () => {
      mockPrisma.project.findMany.mockRejectedValue(new Error('Test error'));

      const response = await GET();
      const data = await response.json();

      expect(data).toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.any(String),
          code: expect.any(String),
        }),
      });
      expect(data.data).toBeUndefined();
    });
  });
});