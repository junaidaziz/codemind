/** @jest-environment node */
import { POST as webhookPOST } from '@/app/api/webhooks/github/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const SECRET = 'test-secret';

process.env.GITHUB_WEBHOOK_SECRET = SECRET;

// Mock GitHubFetcher fetchPRDetails & postComment
jest.mock('@/lib/code-review/github-fetcher', () => ({
  GitHubFetcher: class {
    async fetchPRDetails() {
      return {
        prNumber: 7,
        repository: 'owner/repo',
        title: 'Webhook PR',
        description: 'Testing webhook',
        author: 'hooker',
        headBranch: 'feat/webhook',
        baseBranch: 'main',
        headSha: 'def456',
        url: 'https://example.com/pr/7',
        filesChanged: [
          {
            filename: 'src/core/auth.ts',
            status: 'modified',
            additions: 25,
            deletions: 5,
            changes: 30,
            patch: '+ function auth(){ console.log("auth"); eval("bad"); }',
          }
        ],
        totalAdditions: 25,
        totalDeletions: 5,
        commits: 2,
        analyzedAt: new Date(),
      };
    }
    async postComment(): Promise<{ id: number; url: string }> {
      return { id: 99, url: 'https://example.com/comment/99' };
    }
  }
}));

// Mock ReviewStorage
jest.mock('@/lib/code-review/review-storage', () => ({
  ReviewStorage: class {
    async saveReview(projectId: string, prNumber: number) {
      return { id: 'rev-webhook', projectId, prNumber };
    }
  }
}));

function sign(body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

function makeNextRequest(url: string, body: Record<string, unknown>): NextRequest {
  const json = JSON.stringify(body);
  const req = new Request(url, {
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

describe('POST /api/webhooks/github', () => {
  it('processes pull_request opened event and returns success message', async () => {
    const payload = {
      action: 'opened',
      pull_request: {
        number: 7,
        head: { sha: 'def456' },
      },
      repository: { full_name: 'owner/repo' },
    };

    const req = makeNextRequest('http://localhost/api/webhooks/github', payload);
    const res = await webhookPOST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.action).toBe('opened');
    expect(json.prNumber).toBe(7);
  });

  it('rejects invalid signature', async () => {
    const body = JSON.stringify({ action: 'opened', pull_request: { number: 1 }, repository: { full_name: 'owner/repo' } });
    const req = new Request('http://localhost/api/webhooks/github', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': 'sha256=invalid',
        'x-github-event': 'pull_request',
        'Content-Type': 'application/json'
      },
      body,
    }) as unknown as NextRequest;
    const res = await webhookPOST(req);
    expect(res.status).toBe(401);
  });
});
