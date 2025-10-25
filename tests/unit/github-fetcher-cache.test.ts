import { GitHubFetcher } from '@/lib/code-review/github-fetcher';

interface PRMockData {
  number: number;
  title: string;
  body: string;
  user: { login: string };
  head: { ref: string; sha: string };
  base: { ref: string };
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

interface FileMockData {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
}

interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(h: string): string | null };
  json(): Promise<PRMockData | FileMockData[]>;
}

describe('GitHubFetcher caching & rate limit behavior', () => {
  const owner = 'demo';
  const repo = 'example';
  const prNumber = 42;
  let fetchMock: jest.Mock<Promise<MockResponse>, [string]>;

  beforeEach(() => {
    jest.useRealTimers();
    fetchMock = jest.fn(async (url: string) => {
      const isFiles = url.endsWith('/files');
      const baseHeaders = new Map<string, string>([
        ['x-ratelimit-remaining', '500'],
        ['x-ratelimit-reset', String(Math.floor(Date.now() / 1000) + 60)],
      ]);
      const response: MockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (h: string) => baseHeaders.get(h.toLowerCase()) || null,
        },
        json: async () => (
          isFiles
            ? [
                {
                  filename: 'src/app/page.tsx',
                  status: 'modified',
                  additions: 10,
                  deletions: 2,
                  changes: 12,
                  patch: '--- diff patch ---',
                },
              ]
            : {
                number: prNumber,
                title: 'Improve feature',
                body: 'Details',
                user: { login: 'contributor' },
                head: { ref: 'feat/branch', sha: 'abc123' },
                base: { ref: 'main' },
                commits: 3,
                additions: 10,
                deletions: 2,
                changed_files: 1,
              }
        ),
      };
      return response;
    });
    // Assign to global fetch
    // @ts-expect-error overriding fetch for test
    global.fetch = fetchMock;
  });

  it('caches PR details and files to avoid duplicate fetches', async () => {
    const fetcher = new GitHubFetcher('test-token');
    const first = await fetcher.fetchPRDetails(owner, repo, prNumber);
    expect(first.filesChanged.length).toBe(1);
    const callCountAfterFirst = fetchMock.mock.calls.length;
    expect(callCountAfterFirst).toBe(2); // PR + files

    // Second call should hit cache (no new fetch calls)
    const second = await fetcher.fetchPRDetails(owner, repo, prNumber);
    expect(second.prNumber).toBe(first.prNumber);
    const callCountAfterSecond = fetchMock.mock.calls.length;
    expect(callCountAfterSecond).toBe(callCountAfterFirst); // unchanged => cache hit
  });

  it('clearCache invalidates and triggers new network calls', async () => {
    const fetcher = new GitHubFetcher('test-token');
    await fetcher.fetchPRDetails(owner, repo, prNumber);
    const callsAfterCached = fetchMock.mock.calls.length;
    fetcher.clearCache();
    await fetcher.fetchPRDetails(owner, repo, prNumber);
    const callsAfterInvalidate = fetchMock.mock.calls.length;
    expect(callsAfterInvalidate).toBe(callsAfterCached + 2);
  });
});
