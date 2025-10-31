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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    codeReviewRisk: { deleteMany: jest.fn() },
    codeReviewImpact: { deleteMany: jest.fn() },
  };
}

describe('ReviewStorage.markCommentsPosted', () => {
  it('marks comments as posted and sets githubCommentId', async () => {
    const prismaStub = makePrismaStub();
    const storage = new ReviewStorage(prismaStub);
    const postings = [
      { filePath: 'src/a.ts', lineNumber: 10, githubCommentId: 555 },
      { filePath: 'src/b.ts', lineNumber: 7, githubCommentId: 556 },
    ];
    const res = await storage.markCommentsPosted('rev123', postings);
    expect(res.updated).toBe(2);
    const updateManyMock = prismaStub.codeReviewComment.updateMany as unknown as jest.Mock;
    expect(updateManyMock).toHaveBeenCalledTimes(2);
    const firstCallArgs = updateManyMock.mock.calls[0][0];
    expect(firstCallArgs.where).toMatchObject({ reviewId: 'rev123', filePath: 'src/a.ts', lineNumber: 10 });
    expect(firstCallArgs.data).toMatchObject({ postedToGitHub: true, githubCommentId: 555 });
  });

  it('no-op when postings empty', async () => {
    const prismaStub = makePrismaStub();
    const storage = new ReviewStorage(prismaStub);
    const res = await storage.markCommentsPosted('rev123', []);
    expect(res.updated).toBe(0);
    expect(prismaStub.codeReviewComment.updateMany).not.toHaveBeenCalled();
  });
});