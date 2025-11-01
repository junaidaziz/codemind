/** @jest-environment node */
// Mock OpenAI early to avoid constructor errors from embeddings initialization in imported modules
jest.mock('openai', () => {
  const MockClass = jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({ data: [{ embedding: new Array(64).fill(0) }] }),
    },
  }));
  return { __esModule: true, default: MockClass, OpenAI: MockClass };
});

// Mock modules pulling in ESM Octokit or heavy processing to avoid transform issues in test context
jest.mock('@/lib/analyzeLogs', () => ({ analyzeAndAutoFix: jest.fn().mockResolvedValue({ analysis: { confidence: 0, fixableIssues: [] }, autoFixResult: null }) }));
jest.mock('@/lib/autoFix', () => ({ GitHubAutoFixService: class { async attemptAutoFix(){ return { success:false }; } } }));
jest.mock('@/lib/job-processors', () => ({ initializeJobProcessors: jest.fn() }));

import { POST as webhookPOST } from '@/app/api/github/webhook/route';
import { NextRequest } from 'next/server';

// Mock ReviewStorage to capture persistence call with simulation & suggestions
interface CapturedShape {
  simulation?: { impactAnalysis: { scope: string } };
  documentationSuggestions?: unknown[];
  testingSuggestions?: unknown[];
}
let captured: CapturedShape | null = null;

jest.mock('@/lib/code-review/review-storage', () => ({
  ReviewStorage: class {
    async saveReview(projectId: string, prNumber: number, result: CapturedShape) {
      captured = result; return { id: 'rev-gh-hook', projectId, prNumber };
    }
  }
}));

// Mock GitHubFetcher used by analysis pipeline
jest.mock('@/lib/code-review/github-fetcher', () => ({
  GitHubFetcher: class {
    async fetchPRDetails() {
      return {
        prNumber: 303,
        repository: 'octo/repo',
        title: 'Webhook Direct PR',
        description: 'Testing direct webhook route',
        author: 'octocat',
        headBranch: 'feat/direct',
        baseBranch: 'main',
        headSha: 'abc123direct',
        url: 'https://example.com/pr/303',
        filesChanged: [
          { filename: 'src/lib/core.ts', status: 'modified', additions: 12, deletions: 1, changes: 13, patch: '+ export function core(){ /* change */ }' }
        ],
        totalAdditions: 12,
        totalDeletions: 1,
        commits: 1,
        analyzedAt: new Date(),
      };
    }
  }
}));

function buildWebhookRequest(payload: Record<string, unknown>): NextRequest {
  const body = JSON.stringify(payload);
  const req = new Request('http://localhost/api/github/webhook', {
    method: 'POST',
    headers: { 'x-github-event': 'pull_request', 'Content-Type': 'application/json' },
    body,
  });
  return req as unknown as NextRequest;
}

describe('GitHub webhook direct route integration', () => {
  it('processes pull_request opened and stores simulation & suggestions', async () => {
    const payload = {
      action: 'opened',
      pull_request: { number: 303, head: { sha: 'abc123direct' } },
      repository: { full_name: 'octo/repo', owner: { login: 'octo' }, name: 'repo' },
    };
    const res = await webhookPOST(buildWebhookRequest(payload));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // Storage capture assertions
    expect(captured).not.toBeNull();
    expect(captured?.simulation?.impactAnalysis.scope).toMatch(/isolated|moderate|widespread|minimal/);
    expect(Array.isArray(captured?.documentationSuggestions)).toBe(true);
    expect(Array.isArray(captured?.testingSuggestions)).toBe(true);
  });
});