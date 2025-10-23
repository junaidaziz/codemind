import { z } from 'zod';

// Database Model Types (define manually based on Prisma schema)
export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  defaultBranch: string;
  githubUrl: string;
  lastIndexedAt: Date | null;
  ownerId: string;
  status: string;
  visibility: string;
}

export interface ChatSession {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  summary: string | null;
  totalTokens: number;
  messageCount: number;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface Message {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  tokenCount: number | null;
  contextTokens: number | null;
  memoryIncluded: boolean;
  latencyMs: number | null;
  createdAt: Date;
}

export interface CodeChunk {
  id: string;
  projectId: string;
  path: string;
  sha: string;
  language: string;
  startLine: number;
  endLine: number;
  content: string;
  tokenCount: number;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: Date;
  image: string | null;
  role: string;
}

// Project-related schemas and types
export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name is too long'),
  githubUrl: z.string().url('Must be a valid GitHub URL'),
  userId: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  githubUrl: z.string().url().optional(),
  status: z.enum(['idle', 'indexing', 'ready', 'error']).optional(),
});

export const ProjectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  lastIndexedAt: z.string().nullable(),
  githubUrl: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

// Chat-related schemas and types
export const CreateChatMessageSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  message: z.string().min(1, 'Message cannot be empty').max(5000, 'Message is too long'),
  userId: z.string().optional(),
});

export const ChatSessionResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  project: z.object({
    id: z.string(),
    name: z.string(),
  }),
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
  }),
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    tokenCount: z.number().nullable(),
    latencyMs: z.number().nullable(),
    createdAt: z.string(),
  })),
});

export type CreateChatMessageRequest = z.infer<typeof CreateChatMessageSchema>;
export type ChatSessionResponse = z.infer<typeof ChatSessionResponseSchema>;

// Code chunk types
export interface CodeChunkWithSimilarity extends CodeChunk {
  similarity: number;
}

export const IndexProjectRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  force: z.boolean().optional().default(false),
});

export type IndexProjectRequest = z.infer<typeof IndexProjectRequestSchema>;

// Search and filter types
export const ProjectFiltersSchema = z.object({
  status: z.enum(['idle', 'indexing', 'ready', 'error']).optional(),
  search: z.string().optional(),
  userId: z.string().optional(),
});

export type ProjectFilters = z.infer<typeof ProjectFiltersSchema>;

// Statistics types
export interface ProjectStats {
  totalProjects: number;
  readyProjects: number;
  indexingProjects: number;
  errorProjects: number;
  totalCodeChunks: number;
  totalChatSessions: number;
}

export interface UserStats {
  projectCount: number;
  chatSessionCount: number;
  messageCount: number;
  lastActiveAt: string | null;
}

// Enhanced types with relations
export interface ProjectWithStats extends Project {
  _count: {
    files: number;
    sessions: number;
  };
}

export interface ChatSessionWithMessages extends ChatSession {
  messages: Message[];
  project: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export interface UserWithStats extends User {
  _count: {
    projects: number;
    sessions: number;
  };
}