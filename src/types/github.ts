// GitHub webhook types and schemas for CodeMind
import { z } from 'zod';

// GitHub Repository types
export const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({
    login: z.string(),
    id: z.number(),
    avatar_url: z.string(),
    type: z.string(),
  }),
  private: z.boolean(),
  html_url: z.string(),
  description: z.string().nullable(),
  clone_url: z.string(),
  ssh_url: z.string(),
  default_branch: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  pushed_at: z.string(),
});

// GitHub User/Author types
export const GitHubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatar_url: z.string(),
});

// GitHub Commit types
export const GitHubCommitSchema = z.object({
  id: z.string(),
  message: z.string(),
  timestamp: z.string(),
  url: z.string(),
  author: GitHubUserSchema,
  committer: GitHubUserSchema,
  added: z.array(z.string()),
  removed: z.array(z.string()),
  modified: z.array(z.string()),
});

// Push Event Schema
export const GitHubPushEventSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  repository: GitHubRepositorySchema,
  pusher: z.object({
    name: z.string(),
    email: z.string(),
  }),
  sender: GitHubUserSchema,
  commits: z.array(GitHubCommitSchema),
  head_commit: GitHubCommitSchema.nullable(),
  compare: z.string(),
  forced: z.boolean(),
  deleted: z.boolean(),
  created: z.boolean(),
});

// Pull Request types
export const GitHubPullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean(),
  merged: z.boolean().nullable(),
  merge_commit_sha: z.string().nullable(),
  user: GitHubUserSchema,
  assignees: z.array(GitHubUserSchema),
  requested_reviewers: z.array(GitHubUserSchema),
  head: z.object({
    ref: z.string(),
    sha: z.string(),
    repo: GitHubRepositorySchema.nullable(),
  }),
  base: z.object({
    ref: z.string(),
    sha: z.string(),
    repo: GitHubRepositorySchema,
  }),
  html_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  merged_at: z.string().nullable(),
});

// Pull Request Event Schema
export const GitHubPullRequestEventSchema = z.object({
  action: z.enum(['opened', 'closed', 'reopened', 'synchronize', 'edited', 'assigned', 'unassigned', 'review_requested', 'review_request_removed']),
  number: z.number(),
  pull_request: GitHubPullRequestSchema,
  repository: GitHubRepositorySchema,
  sender: GitHubUserSchema,
  changes: z.object({
    title: z.object({
      from: z.string(),
    }).optional(),
    body: z.object({
      from: z.string(),
    }).optional(),
  }).optional(),
});

// Issue types
export const GitHubIssueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  user: GitHubUserSchema,
  assignees: z.array(GitHubUserSchema),
  labels: z.array(z.object({
    id: z.number(),
    name: z.string(),
    color: z.string(),
    description: z.string().nullable(),
  })),
  html_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
});

// Issues Event Schema
export const GitHubIssuesEventSchema = z.object({
  action: z.enum(['opened', 'closed', 'reopened', 'edited', 'assigned', 'unassigned', 'labeled', 'unlabeled']),
  issue: GitHubIssueSchema,
  repository: GitHubRepositorySchema,
  sender: GitHubUserSchema,
  changes: z.object({
    title: z.object({
      from: z.string(),
    }).optional(),
    body: z.object({
      from: z.string(),
    }).optional(),
  }).optional(),
});

// Release Event Schema
export const GitHubReleaseEventSchema = z.object({
  action: z.enum(['published', 'unpublished', 'created', 'edited', 'deleted', 'prereleased', 'released']),
  release: z.object({
    id: z.number(),
    tag_name: z.string(),
    name: z.string().nullable(),
    body: z.string().nullable(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    created_at: z.string(),
    published_at: z.string().nullable(),
    html_url: z.string(),
    author: GitHubUserSchema,
  }),
  repository: GitHubRepositorySchema,
  sender: GitHubUserSchema,
});

// Generic Webhook Event Schema
export const GitHubWebhookEventSchema = z.discriminatedUnion('event_type', [
  z.object({ event_type: z.literal('push'), ...GitHubPushEventSchema.shape }),
  z.object({ event_type: z.literal('pull_request'), ...GitHubPullRequestEventSchema.shape }),
  z.object({ event_type: z.literal('issues'), ...GitHubIssuesEventSchema.shape }),
  z.object({ event_type: z.literal('release'), ...GitHubReleaseEventSchema.shape }),
]);

// Webhook Configuration Schema
export const WebhookConfigSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  repositoryUrl: z.string(),
  secret: z.string(),
  events: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Webhook Log Schema
export const WebhookLogSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  eventType: z.string(),
  eventAction: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  signature: z.string(),
  processed: z.boolean(),
  success: z.boolean(),
  error: z.string().nullable(),
  processingTime: z.number().optional(),
  createdAt: z.string(),
});

// Request/Response types
export const CreateWebhookRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  repositoryUrl: z.string().url('Valid repository URL is required'),
  events: z.array(z.string()).min(1, 'At least one event must be selected'),
  secret: z.string().optional(),
});

export const UpdateWebhookRequestSchema = CreateWebhookRequestSchema.partial();

// TypeScript types inferred from schemas
export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;
export type GitHubUser = z.infer<typeof GitHubUserSchema>;
export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;
export type GitHubPushEvent = z.infer<typeof GitHubPushEventSchema>;
export type GitHubPullRequest = z.infer<typeof GitHubPullRequestSchema>;
export type GitHubPullRequestEvent = z.infer<typeof GitHubPullRequestEventSchema>;
export type GitHubIssue = z.infer<typeof GitHubIssueSchema>;
export type GitHubIssuesEvent = z.infer<typeof GitHubIssuesEventSchema>;
export type GitHubReleaseEvent = z.infer<typeof GitHubReleaseEventSchema>;
export type GitHubWebhookEvent = z.infer<typeof GitHubWebhookEventSchema>;
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;
export type WebhookLog = z.infer<typeof WebhookLogSchema>;
export type CreateWebhookRequest = z.infer<typeof CreateWebhookRequestSchema>;
export type UpdateWebhookRequest = z.infer<typeof UpdateWebhookRequestSchema>;

// Event type constants
export const GITHUB_EVENTS = {
  PUSH: 'push',
  PULL_REQUEST: 'pull_request',
  ISSUES: 'issues',
  ISSUE_COMMENT: 'issue_comment',
  PULL_REQUEST_REVIEW: 'pull_request_review',
  RELEASE: 'release',
  CREATE: 'create',
  DELETE: 'delete',
  FORK: 'fork',
  STAR: 'star',
  WATCH: 'watch',
} as const;

// Action type constants
export const GITHUB_ACTIONS = {
  PUSH: {
    PUSHED: 'pushed',
  },
  PULL_REQUEST: {
    OPENED: 'opened',
    CLOSED: 'closed',
    REOPENED: 'reopened',
    SYNCHRONIZE: 'synchronize',
    EDITED: 'edited',
    ASSIGNED: 'assigned',
    UNASSIGNED: 'unassigned',
    REVIEW_REQUESTED: 'review_requested',
    REVIEW_REQUEST_REMOVED: 'review_request_removed',
  },
  ISSUES: {
    OPENED: 'opened',
    CLOSED: 'closed',
    REOPENED: 'reopened',
    EDITED: 'edited',
    ASSIGNED: 'assigned',
    UNASSIGNED: 'unassigned',
    LABELED: 'labeled',
    UNLABELED: 'unlabeled',
  },
  RELEASE: {
    PUBLISHED: 'published',
    UNPUBLISHED: 'unpublished',
    CREATED: 'created',
    EDITED: 'edited',
    DELETED: 'deleted',
    PRERELEASED: 'prereleased',
    RELEASED: 'released',
  },
} as const;

// Helper functions
export const extractRepositoryInfo = (url: string) => {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error('Invalid GitHub repository URL');
  
  return {
    owner: match[1],
    repo: match[2].replace('.git', ''),
    fullName: `${match[1]}/${match[2].replace('.git', '')}`,
  };
};

export const validateGitHubSignature = async (
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> => {
  const crypto = await import('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = `sha256=${hmac.digest('hex')}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
};

export const shouldReindexProject = (event: GitHubWebhookEvent): boolean => {
  switch (event.event_type) {
    case 'push':
      // Reindex on pushes to main/default branch with code changes
      return event.ref === `refs/heads/${event.repository.default_branch}` && 
             event.commits.some(commit => 
               commit.added.length > 0 || 
               commit.modified.length > 0 ||
               commit.removed.length > 0
             );
    
    case 'pull_request':
      // Reindex when PR is merged to main branch
      return event.action === 'closed' && 
             event.pull_request.merged === true &&
             event.pull_request.base.ref === event.repository.default_branch;
    
    default:
      return false;
  }
};

export const getEventDescription = (event: GitHubWebhookEvent): string => {
  switch (event.event_type) {
    case 'push':
      return `${event.commits.length} commit${event.commits.length === 1 ? '' : 's'} pushed to ${event.ref.replace('refs/heads/', '')}`;
    
    case 'pull_request':
      return `Pull request #${event.number} ${event.action}: ${event.pull_request.title}`;
    
    case 'issues':
      return `Issue #${event.issue.number} ${event.action}: ${event.issue.title}`;
    
    case 'release':
      return `Release ${event.action}: ${event.release.tag_name}`;
  }
};