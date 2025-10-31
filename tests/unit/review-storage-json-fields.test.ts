import { ReviewStorage, PrismaSubset } from '@/lib/code-review/review-storage';
import type { CodeReviewResult } from '@/types/code-review';

function makeResult(): CodeReviewResult {
  const partial: unknown = {
    prAnalysis: {
      title: 'JSON Field Test',
      url: '',
      headBranch: 'feature/json',
      baseBranch: 'main',
      author: 'tester',
      headSha: 'sha-json',
      filesChanged: [],
      totalAdditions: 5,
      totalDeletions: 0,
    },
    summary: {
      overallScore: 90,
      approved: true,
      requiresChanges: false,
    },
    riskScore: { level: 'medium', overall: 0.5, factors: [] },
    comments: [],
    simulation: { example: true, estimatedHoursSaved: 0.25 },
    documentationSuggestions: ['Improve docs around X'],
    testingSuggestions: ['Add test for edge case Y'],
  };
  return partial as CodeReviewResult;
}

interface Capture { createdData?: Record<string, unknown> }
function makePrismaStub(capture: Capture): PrismaSubset {
  const codeReviewMock = {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      capture.createdData = data;
      return { id: 'rev-json', CodeReviewComment: [], CodeReviewRisk: [], CodeReviewImpact: [] };
    }),
    update: jest.fn(),
  } as unknown as PrismaSubset['codeReview'];
  return {
    codeReview: codeReviewMock,
    codeReviewComment: { findMany: jest.fn(), deleteMany: jest.fn(), updateMany: jest.fn() },
    codeReviewRisk: { deleteMany: jest.fn() },
    codeReviewImpact: { deleteMany: jest.fn() },
  };
}

describe('ReviewStorage JSON field persistence', () => {
  it('persists simulation, documentationSuggestions, testingSuggestions as JSON values', async () => {
    const capture: Capture = {};
    const prismaStub = makePrismaStub(capture);
    const storage = new ReviewStorage(prismaStub);
    const result = makeResult();
    await storage.saveReview('proj-json', 42, result);
    expect(capture.createdData).toBeDefined();
    expect(capture.createdData?.simulation).toEqual(result.simulation);
    expect(capture.createdData?.documentationSuggestions).toEqual(result.documentationSuggestions);
    expect(capture.createdData?.testingSuggestions).toEqual(result.testingSuggestions);
  });
});