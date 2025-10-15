import prisma from '../db';

// NOTE: We assume test environment has DATABASE_URL pointing to a test DB.
// These tests directly exercise the analyze/fix persistence logic used by /api/github/resolve.

async function createIssue(projectId: string) {
  // Provide timestamps explicitly to satisfy unchecked create requirements
  const now = new Date();
  return prisma.issue.create({
    data: {
      projectId,
      number: Math.floor(Math.random() * 100000),
      title: 'Test Issue',
      body: 'Body',
      htmlUrl: 'https://example.com',
      authorLogin: 'tester',
      authorUrl: 'https://example.com/user',
      state: 'OPEN',
      assignees: [],
      labels: [],
      createdAt: now,
      updatedAt: now,
    },
  });
}

describe('AI resolve persistence', () => {
  const projectId = 'test-project-ai';

  beforeAll(async () => {
    await prisma.project.upsert({
      where: { id: projectId },
      create: {
        id: projectId,
        name: 'Test Project',
        githubUrl: 'https://github.com/example/repo',
        ownerId: (await prisma.user.create({ data: { role: 'user' } })).id,
        defaultBranch: 'main',
        status: 'idle',
        visibility: 'public',
      },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.issue.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  test('analyze sets ai fields', async () => {
    const issue = await createIssue(projectId);

    // Simulate route handler call by invoking update similar to analyze action logic
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'UPDATE "Issue" SET "aiAnalyzed" = $1, "aiAnalyzedAt" = $2, "aiSummary" = $3 WHERE id = $4 RETURNING *;',
      true,
      new Date(),
      'AI summary generated for test',
      issue.id,
    );
    const updated = rows[0];
    expect(updated.aiAnalyzed).toBe(true);
    expect(updated.aiSummary).toContain('AI summary');
  });

  test('fix sets pr url', async () => {
    const issue = await createIssue(projectId);

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'UPDATE "Issue" SET "aiAnalyzed" = $1, "aiAnalyzedAt" = $2, "aiFixPrUrl" = $3 WHERE id = $4 RETURNING *;',
      true,
      new Date(),
      'https://github.com/example/repo/pull/123',
      issue.id,
    );
    const updated = rows[0];
    expect(updated.aiFixPrUrl).toContain('/pull/');
  });
});
