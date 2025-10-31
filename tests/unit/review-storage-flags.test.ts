import type { CodeReviewResult } from '@/types/code-review';
import { ReviewStorage, PrismaSubset } from '@/lib/code-review/review-storage';

// Lightweight prisma client stub injected into ReviewStorage
interface CodeReviewCommentCreateRecord {
  filePath: string;
  lineNumber: number;
  severity: string;
  category: string;
  message: string;
  suggestion?: string;
  codeSnippet?: string;
  aiGenerated: boolean;
  postedToGitHub?: boolean;
  githubCommentId?: number;
}
interface UpdateReturnShape {
  id: string;
  CodeReviewComment: CodeReviewCommentCreateRecord[];
  CodeReviewRisk: unknown[];
  CodeReviewImpact: unknown[];
}
interface PrismaStub {
  codeReviewComment: {
    findMany: jest.Mock;
    deleteMany: jest.Mock;
    updateMany: jest.Mock;
  };
  codeReviewRisk: { deleteMany: jest.Mock };
  codeReviewImpact: { deleteMany: jest.Mock };
  codeReview: {
    update: jest.Mock<UpdateReturnShape, [unknown]>;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
}
function makePrismaStub(): PrismaStub {
  return {
    codeReviewComment: {
      findMany: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    codeReviewRisk: { deleteMany: jest.fn().mockResolvedValue({}) },
    codeReviewImpact: { deleteMany: jest.fn().mockResolvedValue({}) },
    codeReview: {
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
}

function makeResult(overrides: Partial<CodeReviewResult> = {}): CodeReviewResult {
  return {
    prAnalysis: {
      title: 'Test PR',
      url: 'http://example.com/pr',
      headBranch: 'feature',
      baseBranch: 'main',
      author: 'alice',
      headSha: 'abc123',
      filesChanged: ['src/a.ts', 'src/b.ts'],
      totalAdditions: 10,
      totalDeletions: 2,
    },
    summary: {
      overallScore: 85,
      approved: false,
      requiresChanges: true,
      strengths: [],
      weaknesses: [],
    },
    riskScore: {
      level: 'high',
      overall: 0.8,
      factors: [],
    },
    comments: [
      { file: 'src/a.ts', line: 5, severity: 'critical', category: 'security', message: 'Issue A', suggestion: 'Fix A', codeSnippet: 'codeA' },
      { file: 'src/b.ts', line: 3, severity: 'high', category: 'performance', message: 'Issue B', suggestion: 'Fix B', codeSnippet: 'codeB' },
    ],
    simulation: { impact: 'MEDIUM', estimatedHoursSaved: 1.5 },
    documentationSuggestions: ['Add README section'],
    testingSuggestions: ['Add unit tests for X'],
    ...overrides,
  } as CodeReviewResult;
}

describe('ReviewStorage.updateReview posted flags preservation', () => {
  it('preserves postedToGitHub and githubCommentId for matching file:line coordinates', async () => {
    const prismaStub = makePrismaStub();
    prismaStub.codeReviewComment.findMany.mockResolvedValue([
      { filePath: 'src/a.ts', lineNumber: 5, githubCommentId: 111 },
    ]);
    prismaStub.codeReview.update.mockImplementation((args: unknown): UpdateReturnShape => {
      const data = (args as { data: { CodeReviewComment: { create: CodeReviewCommentCreateRecord[] } } }).data;
      return {
        id: 'rev1',
        CodeReviewComment: data.CodeReviewComment.create,
        CodeReviewRisk: [],
        CodeReviewImpact: [],
      };
    });
  const storage = new ReviewStorage(prismaStub as unknown as PrismaSubset);
    const result = makeResult();
    const updated = await storage.updateReview('rev1', result);
    const preserved = updated.CodeReviewComment.find(c => c.filePath === 'src/a.ts' && c.lineNumber === 5)!;
    expect(preserved.postedToGitHub).toBe(true);
    expect(preserved.githubCommentId).toBe(111);
    const newComment = updated.CodeReviewComment.find(c => c.filePath === 'src/b.ts')!;
    expect(Boolean(newComment.postedToGitHub)).toBe(false);
  });
});
