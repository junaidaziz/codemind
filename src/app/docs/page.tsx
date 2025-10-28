'use client';

import React, { useState } from 'react';
// Link no longer needed (header removed)
import { PublicRoute } from '../components/ProtectedRoute';
// ThemeToggle removed here to avoid duplicate header; global draggable toggle handles theme switching.

// Documentation sections configuration
const docSections = [
  {
    id: 'overview',
    title: 'Overview',
    icon: '📖',
    description: 'Getting started with CodeMind',
  },
  {
    id: 'api',
    title: 'API Reference',
    icon: '🔧',
    description: 'Complete API documentation',
  },
  {
    id: 'types',
    title: 'TypeScript Types',
    icon: '🏷️',
    description: 'Type definitions and interfaces',
  },
  {
    id: 'examples',
    title: 'Code Examples',
    icon: '💡',
    description: 'Practical implementation examples',
  },
  {
    id: 'sdk',
    title: 'SDK & Integration',
    icon: '🔌',
    description: 'Client libraries and integrations',
  },
  {
    id: 'deployment',
    title: 'Deployment',
    icon: '🚀',
    description: 'Production deployment guide',
  },
];

// Type definitions for API documentation
interface ApiParameter {
  name: string;
  type: string;
  description: string;
}

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  parameters?: ApiParameter[];
  body?: string;
  response: string;
}

interface ApiSection {
  title: string;
  description: string;
  endpoints: ApiEndpoint[];
}

// Navigation component
interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeSection, onSectionChange }) => {
  return (
    <nav className="w-64 surface-panel minimal rounded-none border-r h-full overflow-y-auto">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Documentation</h2>
        <ul className="space-y-2">
          {docSections.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => onSectionChange(section.id)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  activeSection === section.id
                    ? 'surface-card minimal !border-blue-200 bg-blue-50 dark:!border-blue-700 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                    : 'text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{section.icon}</span>
                  <div>
                    <div className="font-medium text-primary">{section.title}</div>
                    <div className="text-sm text-secondary">{section.description}</div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

// Overview section component
const OverviewSection: React.FC = () => {
  return (
    <div className="prose max-w-none dark:prose-invert">
      <h1 className="text-3xl font-bold text-primary mb-8">CodeMind Documentation</h1>
      
      <div className="surface-card minimal !border-blue-200 bg-blue-50 dark:!border-blue-700 dark:bg-blue-950/30 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">🚀 Quick Start</h2>
        <p className="text-secondary">
          Get up and running with CodeMind in minutes. Follow our step-by-step guide to create your first project 
          and start chatting with your codebase.
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-primary mb-4">What is CodeMind?</h2>
      <p className="text-secondary mb-6">
        CodeMind is an AI-powered code analysis and chat platform that helps developers understand, 
        navigate, and work with their codebases more effectively. Using advanced natural language processing 
        and vector embeddings, CodeMind can answer questions about your code, explain complex functions, 
        and help you find relevant code snippets.
      </p>

      <h2 className="text-2xl font-semibold text-primary mb-4">Key Features</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
        <div className="surface-card p-6">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">🧠</span>
            <h3 className="text-lg font-semibold text-primary">AI-Powered Analysis</h3>
          </div>
          <p className="text-secondary">
            Advanced AI models analyze your codebase and provide intelligent responses to your questions.
          </p>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">🔍</span>
            <h3 className="text-lg font-semibold text-primary">Semantic Search</h3>
          </div>
          <p className="text-secondary">
            Find code snippets, functions, and documentation using natural language queries.
          </p>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">💬</span>
            <h3 className="text-lg font-semibold text-primary">Interactive Chat</h3>
          </div>
          <p className="text-secondary">
            Have conversations about your code with context-aware responses and code examples.
          </p>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">📊</span>
            <h3 className="text-lg font-semibold text-primary">Analytics Dashboard</h3>
          </div>
          <p className="text-secondary">
            Monitor usage, performance metrics, and gain insights into your development patterns.
          </p>
        </div>
      </div>

  <h2 className="text-2xl font-semibold text-primary mb-4">Getting Started</h2>
  <ol className="list-decimal list-inside space-y-4 text-secondary">
        <li>
          <strong>Sign up</strong> for a CodeMind account using your email address
        </li>
        <li>
          <strong>Create a project</strong> by providing your repository URL or uploading code files
        </li>
        <li>
          <strong>Wait for indexing</strong> as CodeMind analyzes and processes your codebase
        </li>
        <li>
          <strong>Start chatting</strong> by asking questions about your code
        </li>
      </ol>

      <div className="surface-card p-6 mt-8">
        <h3 className="text-lg font-semibold mb-3 text-primary">📚 Next Steps</h3>
        <ul className="space-y-2 text-secondary">
          <li>• Explore the <strong>API Reference</strong> for integration details</li>
          <li>• Check out <strong>Code Examples</strong> for common use cases</li>
          <li>• Review <strong>TypeScript Types</strong> for type-safe development</li>
          <li>• Learn about <strong>SDK & Integration</strong> options</li>
        </ul>
      </div>
    </div>
  );
};

// API Reference section component
const ApiReferenceSection: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState('projects');

  const apiEndpoints: Record<string, ApiSection> = {
    projects: {
      title: 'Projects API',
      description: 'Manage and interact with your code projects',
      endpoints: [
        {
          method: 'GET',
          path: '/api/projects',
          description: 'List all projects with pagination and filtering',
          parameters: [
            { name: 'page', type: 'number', description: 'Page number (default: 1)' },
            { name: 'limit', type: 'number', description: 'Items per page (default: 10)' },
            { name: 'search', type: 'string', description: 'Search query' },
            { name: 'status', type: 'string', description: 'Filter by status' },
          ],
          response: `{
  "success": true,
  "data": {
    "projects": "ProjectSummary[]",
    "pagination": "PaginationResponse"
  }
}`,
        },
        {
          method: 'POST',
          path: '/api/projects',
          description: 'Create a new project',
          body: `{
  "name": "string",
  "description": "string",
  "repositoryUrl": "string",
  "language": "string"
}`,
          response: `{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "status": "created"
  }
}`,
        },
      ],
    },
    chat: {
      title: 'Chat API',
      description: 'Interactive chat functionality with your codebase',
      endpoints: [
        {
          method: 'POST',
          path: '/api/chat',
          description: 'Send a message and get AI response',
          body: `{
  "sessionId": "string",
  "message": "string",
  "projectId": "string"
}`,
          response: `{
  "success": true,
  "data": {
    "messageId": "string",
    "response": "string",
    "sources": "CodeReference[]"
  }
}`,
        },
      ],
    },
    analytics: {
      title: 'Analytics API',
      description: 'Access usage metrics and performance data',
      endpoints: [
        {
          method: 'GET',
          path: '/api/analytics/dashboard',
          description: 'Get comprehensive dashboard data',
          response: `{
  "success": true,
  "data": "DashboardResponse"
}`,
        },
      ],
    },
  };

  return (
    <div>
  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">API Reference</h1>
      
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
        <p className="text-blue-800 dark:text-blue-200">
          <strong>Base URL:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">https://your-domain.com/api</code>
        </p>
        <p className="text-blue-800 dark:text-blue-200 mt-2">
          <strong>Authentication:</strong> Include <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">Authorization: Bearer &lt;token&gt;</code> header
        </p>
      </div>

      <div className="flex space-x-1 mb-6">
        {Object.entries(apiEndpoints).map(([key, section]) => (
          <button
            key={key}
            onClick={() => setSelectedEndpoint(key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedEndpoint === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {section.title}
          </button>
        ))}
      </div>

      {Object.entries(apiEndpoints).map(([key, section]) => {
        if (selectedEndpoint !== key) return null;

        return (
          <div key={key} className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">{section.title}</h2>
              <p className="text-gray-600">{section.description}</p>
            </div>

            {section.endpoints.map((endpoint, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                    endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                    endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {endpoint.method}
                  </span>
                  <code className="text-lg font-mono">{endpoint.path}</code>
                </div>
                
                <p className="text-gray-600 dark:text-gray-300 mb-4">{endpoint.description}</p>

                {endpoint.parameters && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Parameters</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Name</th>
                            <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Type</th>
                            <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {endpoint.parameters.map((param, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2 font-mono text-sm text-gray-800 dark:text-gray-100">{param.name}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{param.type}</td>
                              <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {endpoint.body && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Request Body</h4>
                    <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                      <code>{endpoint.body}</code>
                    </pre>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Response</h4>
                  <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                    <code>{endpoint.response}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// TypeScript Types section component
const TypesSection: React.FC = () => {
  return (
    <div>
  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">TypeScript Types</h1>
      
      <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-6">
        <p className="text-green-800 dark:text-green-200">
          All types are exported from <code className="bg-green-100 dark:bg-green-800 px-2 py-1 rounded">@/types</code> for easy importing in your applications.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Core Types</h2>
          <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <code>{`interface User {
  id: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

type UserRole = 'admin' | 'user';

interface Project {
  id: string;
  name: string;
  description: string;
  userId: string;
  status: ProjectStatus;
  filesCount: number;
  chunksCount: number;
  lastIndexed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type ProjectStatus = 'created' | 'indexing' | 'active' | 'failed' | 'archived';`}</code>
          </pre>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">API Response Types</h2>
          <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <code>{`interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}`}</code>
          </pre>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Analytics Types</h2>
          <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <code>{`interface DashboardResponse {
  overview: DashboardOverview;
  charts: DashboardCharts;
  trends: DashboardTrends;
  alerts: SystemAlert[];
}

interface ChartDataPoint {
  timestamp: string;
  value: number;
  label: string;
  category?: string;
}

interface PieChartData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

// Code Examples section component
const ExamplesSection: React.FC = () => {
  const exampleCode1 = `import { ApiResponse, Project, CreateProjectRequest } from '@/types';

async function createProject(data: CreateProjectRequest): Promise<Project> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${getAuthToken()}\`
    },
    body: JSON.stringify(data)
  });

  const result: ApiResponse<Project> = await response.json();
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to create project');
  }

  return result.data!;
}

// Usage
const project = await createProject({
  name: 'My Next.js App',
  description: 'Full-stack web application',
  repositoryUrl: 'https://github.com/user/nextjs-app.git',
  language: 'typescript'
});`;

  const exampleCode2 = `import { ChatMessage, SendMessageRequest } from '@/types';

class ChatClient {
  private sessionId: string;
  private projectId: string;

  constructor(sessionId: string, projectId: string) {
    this.sessionId = sessionId;
    this.projectId = projectId;
  }

  async sendMessage(message: string): Promise<ChatMessage> {
    const request: SendMessageRequest = {
      sessionId: this.sessionId,
      message,
      projectId: this.projectId
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${getAuthToken()}\`
      },
      body: JSON.stringify(request)
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to send message');
    }

    return {
      id: result.data.messageId,
      sessionId: this.sessionId,
      role: 'assistant',
      content: result.data.response,
      sources: result.data.sources,
      timestamp: new Date()
    };
  }
}`;

  return (
    <div>
  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Code Examples</h1>
      
      <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-6">
        <p className="text-purple-800 dark:text-purple-200">
          Practical examples showing how to integrate CodeMind into your applications with full type safety.
        </p>
      </div>

      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Creating a Project</h2>
            <p className="text-gray-600 dark:text-gray-300">Complete example of creating and monitoring a new project</p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Code</h3>
            <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
              <code>{exampleCode1}</code>
            </pre>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Chat Integration</h2>
            <p className="text-gray-600 dark:text-gray-300">Implementing chat functionality with context and sources</p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Code</h3>
            <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
              <code>{exampleCode2}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

// SDK Integration section component
const SdkSection: React.FC = () => {
  const sdkExample = `import { CodeMindClient } from '@codemind/sdk';

const client = new CodeMindClient({
  apiKey: process.env.CODEMIND_API_KEY,
  baseUrl: 'https://api.codemind.dev'
});

// Create a project
const project = await client.projects.create({
  name: 'My Project',
  repositoryUrl: 'https://github.com/user/repo.git'
});`;

  const reactExample = `import { useProjects, useChat, useAnalytics } from '@codemind/react';

function MyComponent() {
  const { projects, loading } = useProjects();
  const { sendMessage, messages } = useChat('session-id');
  const { data: analytics } = useAnalytics();

  return (
    <div>
      {projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}`;

  return (
    <div>
  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">SDK & Integration</h1>
      
      <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4 mb-6">
        <p className="text-indigo-800 dark:text-indigo-200">
          Official SDKs and integration guides for different platforms and frameworks.
        </p>
      </div>

      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">JavaScript/TypeScript SDK</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            The official JavaScript SDK provides a type-safe way to interact with the CodeMind API.
          </p>
          
          <div className="mb-4">
            <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Installation</h3>
            <pre className="rounded p-4 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
              <code>npm install @codemind/sdk</code>
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Basic Usage</h3>
            <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
              <code>{sdkExample}</code>
            </pre>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">React Integration</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Use our React hooks for seamless integration with React applications.
          </p>
          
          <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <code>{reactExample}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

// Deployment section component
const DeploymentSection: React.FC = () => {
  const envExample = `# Database
DATABASE_URL="postgresql://user:password@host:5432/codemind"

# Authentication (Supabase)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# AI Services
OPENAI_API_KEY="sk-your-openai-api-key"

# Redis
REDIS_URL="redis://localhost:6379"`;

  const dockerExample = `# Build the Docker image
docker build -t codemind .

# Run with environment file
docker run -d \\
  --name codemind \\
  --env-file .env.production \\
  -p 3000:3000 \\
  codemind`;

  return (
    <div>
  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Deployment Guide</h1>
      
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
        <p className="text-red-800 dark:text-red-200">
          <strong>Production Deployment:</strong> Comprehensive guide for deploying CodeMind to production environments.
        </p>
      </div>

      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Prerequisites</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
            <li>Node.js 18+ installed</li>
            <li>PostgreSQL database with pgvector extension</li>
            <li>Redis for caching and sessions</li>
            <li>Supabase account for authentication</li>
            <li>OpenAI API key</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Environment Variables</h2>
          <pre className="rounded p-4 text-sm overflow-x-auto bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <code>{envExample}</code>
          </pre>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Docker Deployment</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">The recommended way to deploy CodeMind is using Docker containers.</p>
          
          <pre className="rounded p-4 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <code>{dockerExample}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

// Main Documentation Page Component
const DocumentationPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection />;
      case 'api':
        return <ApiReferenceSection />;
      case 'types':
        return <TypesSection />;
      case 'examples':
        return <ExamplesSection />;
      case 'sdk':
        return <SdkSection />;
      case 'deployment':
        return <DeploymentSection />;
      default:
        return <OverviewSection />;
    }
  };

  return (
    <PublicRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-100 pt-4">
        <div className="flex">
          <Navigation activeSection={activeSection} onSectionChange={setActiveSection} />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-8">
              {renderSection()}
            </div>
          </main>
        </div>
      </div>
    </PublicRoute>
  );
};

export default DocumentationPage;