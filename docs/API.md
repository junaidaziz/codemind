# CodeMind API Documentation

## Overview

The CodeMind API provides a comprehensive set of endpoints for managing projects, chat sessions, analytics, and user data. All API endpoints are RESTful and return JSON responses.

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

CodeMind uses Supabase Auth for authentication. Include the authentication token in the Authorization header:

```http
Authorization: Bearer <supabase-jwt-token>
```

### Authentication Endpoints

#### Get Current User
```http
GET /api/auth/user
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://...",
      "createdAt": "2023-01-01T00:00:00Z"
    }
  }
}
```

## Projects API

### List Projects
```http
GET /api/projects
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search query
- `status` (optional): Filter by status (active, archived, indexing)

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "My Project",
        "description": "Project description",
        "status": "active",
        "filesCount": 150,
        "lastIndexed": "2023-01-01T00:00:00Z",
        "createdAt": "2023-01-01T00:00:00Z",
        "updatedAt": "2023-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### Create Project
```http
POST /api/projects
```

**Request Body:**
```json
{
  "name": "Project Name",
  "description": "Project description",
  "repositoryUrl": "https://github.com/user/repo.git",
  "language": "typescript"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Project Name",
    "status": "created",
    "message": "Project created successfully. Indexing will begin shortly."
  }
}
```

### Get Project Details
```http
GET /api/projects/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Project",
    "description": "Project description",
    "status": "active",
    "repositoryUrl": "https://github.com/user/repo.git",
    "language": "typescript",
    "filesCount": 150,
    "chunksCount": 1250,
    "indexingProgress": 100,
    "lastIndexed": "2023-01-01T00:00:00Z",
    "stats": {
      "totalSessions": 45,
      "totalQueries": 320,
      "avgResponseTime": 850
    },
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  }
}
```

### Update Project
```http
PUT /api/projects/{id}
```

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description"
}
```

### Delete Project
```http
DELETE /api/projects/{id}
```

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

### Project Indexing Status
```http
GET /api/projects/{id}/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "indexing",
    "progress": 75,
    "currentFile": "src/components/Dashboard.tsx",
    "processedFiles": 112,
    "totalFiles": 150,
    "estimatedTimeRemaining": 180,
    "errors": []
  }
}
```

### Search Project Files
```http
GET /api/projects/{id}/search
```

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Number of results (default: 10)
- `type` (optional): File type filter

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "file": {
          "id": "uuid",
          "path": "src/components/Dashboard.tsx",
          "type": "typescript",
          "size": 2048
        },
        "chunks": [
          {
            "id": "uuid",
            "content": "function Dashboard() { ... }",
            "lineStart": 10,
            "lineEnd": 25,
            "similarity": 0.92
          }
        ]
      }
    ],
    "query": "dashboard component",
    "totalResults": 15,
    "processingTime": 45
  }
}
```

### Project Statistics
```http
GET /api/projects/{id}/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalSessions": 45,
      "totalQueries": 320,
      "avgResponseTime": 850,
      "successRate": 98.5
    },
    "usage": {
      "daily": [
        { "date": "2023-01-01", "sessions": 5, "queries": 23 },
        { "date": "2023-01-02", "sessions": 8, "queries": 34 }
      ],
      "topQueries": [
        { "query": "how to deploy", "count": 12 },
        { "query": "authentication setup", "count": 8 }
      ]
    },
    "performance": {
      "avgIndexingTime": 120,
      "storageUsed": 52428800,
      "indexEfficiency": 94.2
    }
  }
}
```

## Chat API

### List Chat Sessions
```http
GET /api/chat/sessions
```

**Query Parameters:**
- `projectId` (optional): Filter by project
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "title": "Understanding authentication flow",
        "projectId": "uuid",
        "projectName": "My Project",
        "messageCount": 8,
        "lastMessageAt": "2023-01-01T12:00:00Z",
        "createdAt": "2023-01-01T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

### Create Chat Session
```http
POST /api/chat/sessions
```

**Request Body:**
```json
{
  "projectId": "uuid",
  "title": "New conversation about deployment"
}
```

### Get Chat Session
```http
GET /api/chat/sessions/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Understanding authentication flow",
    "projectId": "uuid",
    "messages": [
      {
        "id": "uuid",
        "role": "user",
        "content": "How does authentication work in this project?",
        "timestamp": "2023-01-01T10:00:00Z"
      },
      {
        "id": "uuid",
        "role": "assistant",
        "content": "The authentication system uses Supabase Auth...",
        "timestamp": "2023-01-01T10:00:30Z",
        "sources": [
          {
            "file": "src/lib/auth.ts",
            "chunk": "Authentication helper functions",
            "similarity": 0.95
          }
        ]
      }
    ],
    "createdAt": "2023-01-01T10:00:00Z",
    "updatedAt": "2023-01-01T12:00:00Z"
  }
}
```

### Send Chat Message
```http
POST /api/chat
```

**Request Body:**
```json
{
  "sessionId": "uuid",
  "message": "How do I set up environment variables?",
  "projectId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid",
    "response": "To set up environment variables in this project...",
    "sources": [
      {
        "file": ".env.example",
        "content": "DATABASE_URL=...",
        "similarity": 0.88
      }
    ],
    "processingTime": 1250
  }
}
```

### Delete Chat Session
```http
DELETE /api/chat/sessions/{id}
```

## Analytics API

### Get Analytics Data
```http
GET /api/analytics
```

**Query Parameters:**
- `metric` (required): Metric type (user_activity, project_usage, chat_sessions, api_requests, system_performance)
- `period` (optional): Time period (hour, day, week, month, quarter, year)
- `startDate` (optional): Start date (ISO string)
- `endDate` (optional): End date (ISO string)
- `projectId` (optional): Filter by project
- `userId` (optional): Filter by user

**Response:**
```json
{
  "success": true,
  "data": {
    "metric": "user_activity",
    "period": "day",
    "data": [
      {
        "timestamp": "2023-01-01T00:00:00Z",
        "value": 45,
        "label": "Active Users"
      }
    ],
    "summary": {
      "total": 1250,
      "average": 41.7,
      "max": 67,
      "min": 12,
      "change": 15.3,
      "trend": "up"
    }
  },
  "metadata": {
    "query": {
      "metric": "user_activity",
      "period": "day"
    },
    "processingTime": 125,
    "dataPoints": 30,
    "cacheHit": false
  }
}
```

### Track Analytics Event
```http
POST /api/analytics
```

**Request Body:**
```json
{
  "type": "user_action",
  "data": {
    "action": "project_created",
    "projectId": "uuid",
    "metadata": {
      "projectType": "typescript",
      "filesCount": 150
    }
  }
}
```

### Get Dashboard Overview
```http
GET /api/analytics/dashboard
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 125,
      "activeUsers": 45,
      "totalProjects": 78,
      "activeProjects": 34,
      "totalSessions": 1250,
      "totalQueries": 8750,
      "avgResponseTime": 850,
      "systemHealth": "healthy",
      "uptime": 99.8
    },
    "charts": {
      "userActivity": [
        {
          "timestamp": "2023-01-01T00:00:00Z",
          "value": 45,
          "label": "Active Users"
        }
      ],
      "projectUsage": [
        {
          "name": "CodeMind Core",
          "value": 320,
          "percentage": 35,
          "color": "#3B82F6"
        }
      ],
      "apiRequests": [
        {
          "category": "2023-01-01",
          "value": 1250,
          "comparison": 1100,
          "change": 13.6
        }
      ],
      "performance": [
        {
          "timestamp": "2023-01-01T00:00:00Z",
          "value": 850,
          "label": "Response Time (ms)"
        }
      ]
    },
    "trends": {
      "users": { "current": 45, "change": 12 },
      "projects": { "current": 34, "change": 8 },
      "sessions": { "current": 89, "change": -5 },
      "errors": { "current": 2, "change": -50 }
    },
    "alerts": [
      {
        "type": "warning",
        "message": "High API usage detected",
        "timestamp": "2023-01-01T12:00:00Z"
      }
    ]
  }
}
```

## Jobs API

### List Background Jobs
```http
GET /api/jobs
```

**Query Parameters:**
- `status` (optional): Filter by status (pending, processing, completed, failed)
- `type` (optional): Filter by job type
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "uuid",
        "type": "index_project",
        "status": "processing",
        "progress": 75,
        "data": {
          "projectId": "uuid",
          "totalFiles": 150,
          "processedFiles": 112
        },
        "result": null,
        "error": null,
        "createdAt": "2023-01-01T10:00:00Z",
        "startedAt": "2023-01-01T10:00:05Z",
        "completedAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### Get Job Status
```http
GET /api/jobs/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "index_project",
    "status": "completed",
    "progress": 100,
    "data": {
      "projectId": "uuid",
      "totalFiles": 150,
      "processedFiles": 150
    },
    "result": {
      "indexedFiles": 150,
      "createdChunks": 1250,
      "processingTime": 125000,
      "errors": []
    },
    "error": null,
    "createdAt": "2023-01-01T10:00:00Z",
    "startedAt": "2023-01-01T10:00:05Z",
    "completedAt": "2023-01-01T10:02:10Z"
  }
}
```

## Error Handling

All API endpoints return standardized error responses:

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "requestId": "uuid"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Common Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_REQUIRED` - Valid authentication token required
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RESOURCE_CONFLICT` - Resource already exists or conflicts
- `RATE_LIMIT_EXCEEDED` - API rate limit exceeded
- `INTERNAL_ERROR` - Server-side error occurred
- `SERVICE_UNAVAILABLE` - External service unavailable

## Rate Limiting

API requests are rate limited per user:

- **Authenticated users**: 1000 requests per hour
- **Project operations**: 100 requests per hour
- **Chat messages**: 60 requests per hour
- **Analytics queries**: 200 requests per hour

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Webhooks

CodeMind supports webhooks for real-time notifications:

### Webhook Events

- `project.created` - New project created
- `project.indexed` - Project indexing completed
- `project.failed` - Project indexing failed
- `chat.session_created` - New chat session started
- `user.registered` - New user registration

### Webhook Payload Format
```json
{
  "event": "project.indexed",
  "timestamp": "2023-01-01T12:00:00Z",
  "data": {
    "projectId": "uuid",
    "projectName": "My Project",
    "filesIndexed": 150,
    "processingTime": 125000
  }
}
```

## SDK and Libraries

### JavaScript/TypeScript SDK

```typescript
import { CodeMindClient } from '@codemind/sdk';

const client = new CodeMindClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.codemind.dev'
});

// Create a project
const project = await client.projects.create({
  name: 'My Project',
  repositoryUrl: 'https://github.com/user/repo.git'
});

// Send a chat message
const response = await client.chat.send({
  sessionId: 'session-uuid',
  message: 'How does authentication work?',
  projectId: project.id
});
```

### Python SDK

```python
from codemind import CodeMindClient

client = CodeMindClient(
    api_key='your-api-key',
    base_url='https://api.codemind.dev'
)

# Create a project
project = client.projects.create(
    name='My Project',
    repository_url='https://github.com/user/repo.git'
)

# Send a chat message
response = client.chat.send(
    session_id='session-uuid',
    message='How does authentication work?',
    project_id=project.id
)
```

## Examples and Tutorials

### Complete Project Setup Example

```typescript
// 1. Create a new project
const project = await fetch('/api/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'E-commerce Backend',
    description: 'Node.js e-commerce API',
    repositoryUrl: 'https://github.com/user/ecommerce-api.git',
    language: 'typescript'
  })
});

// 2. Monitor indexing progress
const checkStatus = async (projectId: string) => {
  const response = await fetch(`/api/projects/${projectId}/status`);
  const { data } = await response.json();
  
  if (data.status === 'completed') {
    console.log('Indexing completed!');
    return true;
  }
  
  console.log(`Progress: ${data.progress}%`);
  setTimeout(() => checkStatus(projectId), 5000);
};

// 3. Start a chat session
const session = await fetch('/api/chat/sessions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    projectId: project.id,
    title: 'Understanding the API structure'
  })
});

// 4. Send messages
const chatResponse = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sessionId: session.id,
    message: 'Show me the user authentication endpoints',
    projectId: project.id
  })
});
```

For more examples and detailed tutorials, visit our [documentation website](https://docs.codemind.dev).