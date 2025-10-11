import { CodeMindChatMemory } from '../langchain-memory';
import prisma from '../db';

// Mock Prisma
jest.mock('../db', () => ({
  chatSession: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
}));

describe('CodeMindChatMemory', () => {
  const mockSessionId = 'test-session-123';
  let memory: CodeMindChatMemory;

  beforeEach(() => {
    jest.clearAllMocks();
    memory = new CodeMindChatMemory({ sessionId: mockSessionId });
  });

  describe('loadMemoryVariables', () => {
    it('should return empty history when no messages exist', async () => {
      // Mock empty messages
      (prisma.message.findMany as jest.Mock).mockResolvedValue([]);

      const result = await memory.loadMemoryVariables({});

      expect(result).toEqual({ history: '' });
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: {
          sessionId: mockSessionId,
          memoryIncluded: true,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          content: true,
          createdAt: true,
        },
      });
    });

    it('should format conversation history correctly', async () => {
      // Mock conversation messages
      const mockMessages = [
        {
          role: 'user',
          content: 'What is this function doing?',
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          role: 'assistant',
          content: 'This function processes user input and returns a formatted response.',
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      (prisma.message.findMany as jest.Mock).mockResolvedValue(mockMessages);

      const result = await memory.loadMemoryVariables({});

      expect(result.history).toContain('Human: What is this function doing?');
      expect(result.history).toContain('Assistant: This function processes user input and returns a formatted response.');
    });
  });

  describe('saveContext', () => {
    it('should save context and manage token limits', async () => {
      // Mock session data
      const mockSession = {
        id: mockSessionId,
        totalTokens: 500,
        messageCount: 2,
      };

      (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(mockSession);
      (prisma.chatSession.update as jest.Mock).mockResolvedValue(mockSession);
      (prisma.message.create as jest.Mock).mockResolvedValue({});

      const inputs = { input: 'Test question' };
      const outputs = { output: 'Test response' };

      await memory.saveContext(inputs, outputs);

      // Verify session update was called
      expect(prisma.chatSession.update).toHaveBeenCalledWith({
        where: { id: mockSessionId },
        data: {
          lastActiveAt: expect.any(Date),
          totalTokens: expect.any(Number),
          messageCount: expect.any(Number),
        },
      });
    });

    it('should trigger summarization when token limit is exceeded', async () => {
      // Mock session with high token count
      const mockSession = {
        id: mockSessionId,
        totalTokens: 7000, // Above the 6000 limit
        messageCount: 20,
      };

      const mockMessages = [
        { role: 'user', content: 'Old question 1' },
        { role: 'assistant', content: 'Old response 1' },
        { role: 'user', content: 'Old question 2' },
        { role: 'assistant', content: 'Old response 2' },
      ];

      (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(mockSession);
      (prisma.message.findMany as jest.Mock).mockResolvedValue(mockMessages);
      (prisma.chatSession.update as jest.Mock).mockResolvedValue(mockSession);
      (prisma.message.updateMany as jest.Mock).mockResolvedValue({});

      const inputs = { input: 'New question' };
      const outputs = { output: 'New response' };

      await memory.saveContext(inputs, outputs);

      // Verify that summarization was triggered (updateMany called to exclude old messages)
      expect(prisma.message.updateMany).toHaveBeenCalled();
      expect(prisma.chatSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            summary: expect.any(String),
          }),
        })
      );
    });
  });

  describe('clear', () => {
    it('should clear memory by updating session', async () => {
      (prisma.chatSession.update as jest.Mock).mockResolvedValue({});
      (prisma.message.updateMany as jest.Mock).mockResolvedValue({});

      await memory.clear();

      expect(prisma.message.updateMany).toHaveBeenCalledWith({
        where: { sessionId: mockSessionId },
        data: { memoryIncluded: false },
      });

      expect(prisma.chatSession.update).toHaveBeenCalledWith({
        where: { id: mockSessionId },
        data: {
          summary: null,
          totalTokens: 0,
          messageCount: 0,
        },
      });
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics', async () => {
      const mockSession = {
        totalTokens: 1500,
        messageCount: 10,
        summary: 'Test summary',
        lastActiveAt: new Date('2024-01-01T10:00:00Z'),
      };

      (prisma.chatSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

      const stats = await memory.getMemoryStats();

      expect(stats).toEqual({
        totalTokens: 1500,
        messageCount: 10,
        hasSummary: true,
        lastActiveAt: mockSession.lastActiveAt,
      });
    });
  });
});