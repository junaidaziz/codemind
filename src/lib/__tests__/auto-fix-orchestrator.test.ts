import prisma from '../db';
import { startAutoFix } from '../auto-fix-orchestrator';

// NOTE: Skips if no usable DATABASE_URL (light heuristic)
const dbUrl = process.env.DATABASE_URL || '';
const canRun = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

describe('auto-fix orchestrator (phase1)', () => {
  if (!canRun) {
    it.skip('skipped because DATABASE_URL not pointing to local test db', () => {});
    return;
  }

  const projectId = `proj_autofix_${Date.now()}`;
  let issueId: string;
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { role: 'user' } });
    userId = user.id;
    await prisma.project.create({
      data: {
        id: projectId,
        name: 'AutoFix Test',
        githubUrl: 'https://github.com/example/repo',
        ownerId: userId,
        defaultBranch: 'main',
        status: 'idle',
        visibility: 'public',
      },
    });
    const issue = await prisma.issue.create({
      data: {
        projectId,
        number: 42,
        title: 'Example issue',
        body: 'Something is broken',
        htmlUrl: 'https://example.com/issue/42',
        authorLogin: 'tester',
        authorUrl: 'https://example.com/user',
        assignees: [],
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        state: 'OPEN',
      },
    });
    issueId = issue.id;
  });

  afterAll(async () => {
    await prisma.issue.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } });
  });

  test('startAutoFix returns plan and session', async () => {
    const plan = await startAutoFix({ projectId, userId, issueId });
    expect(plan.sessionId).toBeTruthy();
    expect(plan.steps.length).toBeGreaterThan(0);
  });
});
