import { startAutoFix } from '../auto-fix-orchestrator';
import prisma from '../db';

const dbUrl = process.env.DATABASE_URL || '';
const canRun = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

describe('auto-fix analysis (phase2)', () => {
  if (!canRun) {
    it.skip('skipped (no local db)', () => {});
    return;
  }

  const projectId = `proj_analysis_${Date.now()}`;
  let userId: string;
  let issueId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { role: 'user' } });
    userId = user.id;
    await prisma.project.create({
      data: {
        id: projectId,
        name: 'Analysis Test',
        githubUrl: 'https://github.com/example/repo',
        ownerId: userId,
        defaultBranch: 'main',
        status: 'idle',
        visibility: 'public',
      },
    });
    // Seed a few project files (heuristic will scan these)
    const paths = [
      'src/components/LoginForm.tsx',
      'src/lib/auth/login.ts',
      'src/pages/api/auth/[...nextauth].ts',
      'README.md',
    ];
    for (const p of paths) {
      await prisma.projectFile.create({
        data: {
          projectId,
          relativePath: p,
          fileType: p.endsWith('.md') ? 'doc' : 'code',
          language: p.endsWith('.tsx') ? 'tsx' : p.endsWith('.ts') ? 'ts' : 'text',
          extension: p.split('.').pop() || '',
          size: 100,
          lines: 10,
          lastModified: new Date(),
        },
      });
    }
    const issue = await prisma.issue.create({
      data: {
        projectId,
        number: 101,
        title: 'Login failure error handling',
        body: 'Users report auth failure when token expires',
        htmlUrl: 'https://example.com/issue/101',
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
    await prisma.projectFile.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  test('analysis returns candidate files', async () => {
    const plan = await startAutoFix({ projectId, userId, issueId });
    expect(plan.steps.some(s => s.includes('Candidate files')) || plan.summary.includes('candidate files')).toBeTruthy();
  });
});
