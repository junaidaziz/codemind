import { ReviewStorage, PrismaSubset } from '@/lib/code-review/review-storage';

function makePrismaStub(): PrismaSubset {
  const codeReviewMock = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as PrismaSubset['codeReview'];
  return {
    codeReview: codeReviewMock,
    codeReviewComment: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    codeReviewRisk: { deleteMany: jest.fn() },
    codeReviewImpact: { deleteMany: jest.fn() },
  };
}

describe('ReviewStorage.getPostedInlineCommentCoordinates', () => {
  it('returns a set of file:line strings for posted inline comments', async () => {
    const prismaStub = makePrismaStub();
  (prismaStub.codeReview.findUnique as jest.Mock).mockResolvedValue({
      CodeReviewComment: [
        { filePath: 'src/a.ts', lineNumber: 10 },
        { filePath: 'src/b.ts', lineNumber: 7 },
      ],
    });
    const storage = new ReviewStorage(prismaStub);
    const set = await storage.getPostedInlineCommentCoordinates('proj', 1);
    expect(set.has('src/a.ts:10')).toBe(true);
    expect(set.has('src/b.ts:7')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('returns empty set when no review or no comments', async () => {
    const prismaStub = makePrismaStub();
  (prismaStub.codeReview.findUnique as jest.Mock).mockResolvedValue(null);
    const storage = new ReviewStorage(prismaStub);
    const set = await storage.getPostedInlineCommentCoordinates('proj', 2);
    expect(set.size).toBe(0);
  });
});
