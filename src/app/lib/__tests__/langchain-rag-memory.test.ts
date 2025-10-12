import { generateAnswer, GenerateAnswerInput } from '../langchain-rag';
import prisma from '../db';

// Mock external dependencies
jest.mock('../db');
jest.mock('../langchain-vectorstore');
jest.mock('../langchain-memory');
jest.mock('@langchain/openai');

describe('RAG Chain with Memory Integration', () => {
  const mockProjectId = 'test-project-123';
  const mockUserId = 'test-user-456';
  const mockSessionId = 'test-session-789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAnswer', () => {
    it('should create new session when sessionId is not provided', async () => {
      // Mock project existence
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: mockProjectId,
        name: 'Test Project',
      });

      // Mock session creation
      const mockNewSession = { id: 'new-session-123' };
      (prisma.chatSession.create as jest.Mock).mockResolvedValue(mockNewSession);

      // Mock message creation
      (prisma.message.create as jest.Mock).mockResolvedValue({});

      const input: GenerateAnswerInput = {
        query: 'What does this function do?',
        projectId: mockProjectId,
        userId: mockUserId,
        // No sessionId provided
      };

      try {
        await generateAnswer(input);
      } catch {
        // Expected to fail due to mocked dependencies, but we're testing the session creation logic
      }

      expect(prisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          projectId: mockProjectId,
          userId: mockUserId,
          title: 'What does this function do?',
        },
      });
    });

    it('should use existing session when sessionId is provided', async () => {
      // Mock project existence
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: mockProjectId,
        name: 'Test Project',
      });

      // Mock message creation
      (prisma.message.create as jest.Mock).mockResolvedValue({});

      const input: GenerateAnswerInput = {
        query: 'Follow-up question about the function',
        projectId: mockProjectId,
        userId: mockUserId,
        sessionId: mockSessionId,
      };

      try {
        await generateAnswer(input);
      } catch {
        // Expected to fail due to mocked dependencies
      }

      // Should not create a new session
      expect(prisma.chatSession.create).not.toHaveBeenCalled();

      // Should save user message with existing session
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: mockSessionId,
          role: 'user',
          content: 'Follow-up question about the function',
        },
      });
    });

    it('should throw error when project does not exist', async () => {
      // Mock project not found
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      const input: GenerateAnswerInput = {
        query: 'Test query',
        projectId: 'non-existent-project',
        userId: mockUserId,
      };

      await expect(generateAnswer(input)).rejects.toThrow('Project not found: non-existent-project');
    });

    it('should validate input parameters', async () => {
      const invalidInput = {
        query: '', // Empty query should fail validation
        projectId: mockProjectId,
        userId: mockUserId,
      };

      await expect(generateAnswer(invalidInput as GenerateAnswerInput)).rejects.toThrow();
    });
  });

  describe('Memory Integration Flow', () => {
    it('should follow the complete conversation flow with memory', async () => {
      // Mock successful project lookup
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: mockProjectId,
        name: 'Test Project',
      });

      // Mock session creation
      (prisma.chatSession.create as jest.Mock).mockResolvedValue({
        id: mockSessionId,
      });

      // Mock message creation
      (prisma.message.create as jest.Mock).mockResolvedValue({});

      const firstQuery: GenerateAnswerInput = {
        query: 'What is the main function of this component?',
        projectId: mockProjectId,
        userId: mockUserId,
      };

      try {
        await generateAnswer(firstQuery);
      } catch {
        // Expected due to mocked dependencies
      }

      // Verify user message was saved
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: expect.any(String),
          role: 'user',
          content: 'What is the main function of this component?',
        },
      });

      // Reset mocks for second query
      jest.clearAllMocks();
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: mockProjectId,
        name: 'Test Project',
      });
      (prisma.message.create as jest.Mock).mockResolvedValue({});

      const followUpQuery: GenerateAnswerInput = {
        query: 'Can you explain more about that function?',
        projectId: mockProjectId,
        userId: mockUserId,
        sessionId: mockSessionId, // Continue same conversation
      };

      try {
        await generateAnswer(followUpQuery);
      } catch {
        // Expected due to mocked dependencies
      }

      // Should not create new session for follow-up
      expect(prisma.chatSession.create).not.toHaveBeenCalled();

      // Should save follow-up message
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: mockSessionId,
          role: 'user',
          content: 'Can you explain more about that function?',
        },
      });
    });
  });
});