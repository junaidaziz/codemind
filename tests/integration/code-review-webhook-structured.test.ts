/** @jest-environment node */
import { POST as webhookPOST } from '@/app/api/webhooks/github/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const SECRET = 'test-secret-structured';
process.env.GITHUB_WEBHOOK_SECRET = SECRET;

// Minimal shape for captured CodeReviewResult
interface CapturedSimulationImpactAnalysis { scope: string }
interface CapturedSimulation { impactAnalysis: CapturedSimulationImpactAnalysis }
interface CapturedResultShape {
  simulation: CapturedSimulation;
  documentationSuggestions: unknown[];
  testingSuggestions: unknown[];
  recommendations: string[];
}
let capturedResult: CapturedResultShape | null = null;

// Mock GitHubFetcher to supply deterministic PR details & capture inline comments posting
jest.mock('@/lib/code-review/github-fetcher', () => ({
  GitHubFetcher: class {
    async fetchPRDetails() {
      return {
        prNumber: 101,
        repository: 'owner/repo',
        title: 'Structured PR',
        description: 'Testing structured fields',
        author: 'struct',
        headBranch: 'feat/structured',
        baseBranch: 'main',
        headSha: 'feedface',
        url: 'https://example.com/pr/101',
        filesChanged: [
          {
            filename: 'src/security/auth.ts',
            status: 'modified',
            additions: 30,
            deletions: 2,
            changes: 32,
            patch: '+ eval("danger");\n+ function login(){ if(true){ console.log("x"); } }',
          },
        ],
        totalAdditions: 30,
        totalDeletions: 2,
        commits: 4,
        analyzedAt: new Date(),
      };
    }
    async postComment() { return { id: 555, url: 'https://example.com/comment/555' }; }
  async postInlineComments(owner: string, repo: string, pr: number, sha: string, comments: Array<{ path: string; line: number; body: string }>) {
      // Simulate GitHub API response mapping
      return comments.map((c, i) => ({ path: c.path, line: c.line, githubId: 700 + i }));
    }
  }
}));

// Mock ReviewStorage capturing the CodeReviewResult passed
jest.mock('@/lib/code-review/review-storage', () => ({
  ReviewStorage: class {
  async saveReview(projectId: string, prNumber: number, result: CapturedResultShape) {
      capturedResult = result; // capture for assertions
      return { id: 'rev-structured', projectId, prNumber };
    }
    async getReview(projectId: string, prNumber: number) {
      return { id: 'rev-structured', projectId, prNumber };
    }
    async markCommentsPosted() { return { updated: 1 }; }
  }
}));

function sign(body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

function makeReq(payload: Record<string, unknown>): NextRequest {
  const json = JSON.stringify(payload);
  const req = new Request('http://localhost/api/webhooks/github', {
    method: 'POST',
    headers: {
      'x-hub-signature-256': sign(json),
      'x-github-event': 'pull_request',
      'Content-Type': 'application/json'
    },
    body: json,
  });
  return req as unknown as NextRequest;
}

describe('Webhook structured fields integration', () => {
  it('captures simulation and suggestions in CodeReviewResult for opened event', async () => {
    const payload = {
      action: 'opened',
      pull_request: { number: 101, head: { sha: 'feedface' } },
      repository: { full_name: 'owner/repo' },
    };
    const res = await webhookPOST(makeReq(payload));
    expect(res.status).toBe(200);
  expect(capturedResult).not.toBeNull();
  const result = capturedResult!; // assert non-null for subsequent checks
  // Simulation structure checks
  expect(result.simulation).toBeDefined();
  expect(result.simulation.impactAnalysis.scope).toMatch(/isolated|moderate|widespread/);
  // Suggestions separation
  expect(Array.isArray(result.documentationSuggestions)).toBe(true);
  expect(Array.isArray(result.testingSuggestions)).toBe(true);
  // High severity comments lead to at least one recommendation
  expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
