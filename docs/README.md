# CodeMind Documentation

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Architecture](#architecture)
4. [Development Setup](#development-setup)
5. [API Documentation](#api-documentation)
6. [User Guide](#user-guide)
7. [Administrator Guide](#administrator-guide)
8. [Troubleshooting](#troubleshooting)
9. [Contributing](#contributing)
10. [Deployment](#deployment)

## Overview

CodeMind is an intelligent code understanding and chat platform that helps developers explore, understand, and work with codebases through natural language interactions. The platform provides advanced code indexing, semantic search, and AI-powered assistance for code analysis and development tasks.

### Key Features

- **Intelligent Code Indexing**: Automatically processes and indexes codebases for fast, semantic search
- **AI-Powered Chat**: Natural language interactions with your codebase using advanced language models
- **Project Management**: Organize and manage multiple code projects with comprehensive analytics
- **Real-time Collaboration**: Share insights and collaborate with team members
- **Advanced Analytics**: Monitor usage patterns, system performance, and user engagement
- **Role-Based Access Control**: Granular permissions and user management system
- **Background Processing**: Efficient handling of large codebases with queue-based processing

### Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL with Prisma ORM, pgvector extension for embeddings
- **Authentication**: Supabase Auth with role-based access control
- **AI/ML**: OpenAI GPT models, LangChain for document processing
- **Analytics**: Custom analytics service with Recharts visualization
- **Monitoring**: Sentry for error tracking, custom logging system
- **Infrastructure**: Background job processing with queue management

## Getting Started

### Prerequisites

Before setting up CodeMind, ensure you have:

- Node.js 18+ and pnpm installed
- PostgreSQL database with pgvector extension
- Supabase account for authentication
- OpenAI API key for AI features
- (Optional) Sentry account for error monitoring

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/codemind.git
   cd codemind
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.production.template .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database**
   ```bash
   pnpm prisma generate
   pnpm prisma migrate deploy
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

6. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser

### First Steps

1. **Create an account** - Sign up using the authentication system
2. **Create your first project** - Upload or connect your codebase
3. **Wait for indexing** - The system will process and index your code
4. **Start chatting** - Ask questions about your codebase in natural language
5. **Explore features** - Check out the analytics dashboard and project management tools

## Architecture

### System Overview

CodeMind follows a modern, scalable architecture pattern:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   API Gateway   │    │   Background    │
│   (Next.js)     │◄──►│  (Next.js API)  │◄──►│   Jobs Queue    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Layer      │    │   Service       │    │   Processing    │
│   Components    │    │   Layer         │    │   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │   Database      │    │   External      │
                    │  (PostgreSQL)   │    │   Services      │
                    └─────────────────┘    └─────────────────┘
```

### Core Components

#### 1. Frontend Architecture
- **App Router**: Next.js 15 app directory structure
- **Component System**: Reusable UI components with TypeScript
- **State Management**: React context and hooks for client state
- **Authentication**: Integrated Supabase Auth components
- **Real-time Updates**: WebSocket connections for live data

#### 2. API Layer
- **REST Endpoints**: Comprehensive API for all platform features
- **Authentication Middleware**: Request validation and user context
- **Rate Limiting**: API usage controls and abuse prevention
- **Error Handling**: Standardized error responses and logging
- **Performance Monitoring**: Request timing and analytics

#### 3. Database Schema
- **Users & Authentication**: User profiles and session management
- **Projects**: Code repository management and metadata
- **Chat Sessions**: Conversation history and context
- **Files & Chunks**: Document storage and semantic chunks
- **Analytics**: Usage tracking and performance metrics

#### 4. Background Processing
- **Job Queue**: Redis-based task processing
- **Document Indexing**: Code parsing and chunk generation
- **Embedding Generation**: Vector embeddings for semantic search
- **Analytics Processing**: Data aggregation and metrics calculation

### Security Architecture

- **Authentication**: JWT-based with Supabase Auth
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: At-rest and in-transit encryption
- **API Security**: Rate limiting, CORS, and input validation
- **Audit Logging**: Comprehensive activity tracking

## Development Setup

### Local Development Environment

#### Prerequisites Installation

1. **Node.js and pnpm**
   ```bash
   # Install Node.js 18+ using nvm
   nvm install 18
   nvm use 18
   
   # Install pnpm
   npm install -g pnpm
   ```

2. **PostgreSQL with pgvector**
   ```bash
   # macOS with Homebrew
   brew install postgresql
   brew install pgvector
   
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   # Follow pgvector installation guide
   ```

3. **Development Tools**
   ```bash
   # VS Code extensions (recommended)
   code --install-extension ms-vscode.vscode-typescript-next
   code --install-extension bradlc.vscode-tailwindcss
   code --install-extension prisma.prisma
   ```

#### Environment Configuration

Create `.env.local` with the following variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/codemind"

# Authentication (Supabase)
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AI Services
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-4-turbo-preview"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# Monitoring (Optional)
SENTRY_DSN="your-sentry-dsn"
NEXT_PUBLIC_SENTRY_DSN="your-public-sentry-dsn"

# Background Jobs
REDIS_URL="redis://localhost:6379"

# Analytics
ENABLE_ANALYTICS="true"
ANALYTICS_RETENTION_DAYS="90"
```

#### Database Setup

1. **Install Prisma CLI**
   ```bash
   pnpm add -D prisma
   ```

2. **Generate Prisma client**
   ```bash
   pnpm prisma generate
   ```

3. **Run migrations**
   ```bash
   pnpm prisma migrate dev
   ```

4. **Seed the database (optional)**
   ```bash
   pnpm prisma db seed
   ```

#### Running the Application

1. **Start development server**
   ```bash
   pnpm dev
   ```

2. **Run with Turbopack (faster)**
   ```bash
   pnpm dev --turbo
   ```

3. **Background jobs (separate terminal)**
   ```bash
   pnpm jobs:dev
   ```

#### Development Workflow

1. **Code Structure**
   ```
   src/
   ├── app/                 # App router pages and layouts
   │   ├── api/            # API routes
   │   ├── auth/           # Authentication pages
   │   ├── chat/           # Chat interface
   │   ├── projects/       # Project management
   │   └── analytics/      # Analytics dashboard
   ├── components/         # Reusable React components
   │   ├── ui/            # Base UI components
   │   └── ...            # Feature components
   ├── lib/               # Utility functions and services
   ├── types/             # TypeScript type definitions
   └── app/               # App-specific utilities
   ```

2. **Development Commands**
   ```bash
   # Type checking
   pnpm type-check
   
   # Linting
   pnpm lint
   pnpm lint:fix
   
   # Database operations
   pnpm prisma studio     # Database GUI
   pnpm prisma migrate    # Create migration
   pnpm prisma reset      # Reset database
   
   # Building
   pnpm build
   pnpm start
   ```

3. **Testing**
   ```bash
   # Unit tests
   pnpm test
   pnpm test:watch
   
   # E2E tests
   pnpm test:e2e
   ```

### Debugging and Troubleshooting

#### Common Issues

1. **Database Connection Errors**
   - Verify PostgreSQL is running
   - Check DATABASE_URL in .env.local
   - Ensure pgvector extension is installed

2. **Authentication Issues**
   - Verify Supabase configuration
   - Check CORS settings in Supabase dashboard
   - Ensure callback URLs are configured

3. **API Rate Limiting**
   - Check API key quotas (OpenAI)
   - Monitor rate limiting logs
   - Adjust rate limits in configuration

#### Debugging Tools

1. **Prisma Studio**
   ```bash
   pnpm prisma studio
   ```

2. **Database Logs**
   ```bash
   # PostgreSQL logs
   tail -f /usr/local/var/log/postgres.log
   ```

3. **Application Logs**
   - Check browser console for client errors
   - Monitor server logs in terminal
   - Use Sentry dashboard for production errors

#### Performance Monitoring

- **Request Timing**: Built-in performance monitoring
- **Database Queries**: Prisma query logging
- **Memory Usage**: Node.js memory profiling
- **Analytics Dashboard**: Real-time system metrics

### Code Style and Standards

#### TypeScript Guidelines

- Use strict TypeScript configuration
- Define interfaces for all data structures
- Implement proper error handling with typed errors
- Use Zod for runtime validation

#### React Best Practices

- Use functional components with hooks
- Implement proper error boundaries
- Follow component composition patterns
- Use proper loading and error states

#### CSS and Styling

- Use Tailwind CSS for styling
- Follow mobile-first responsive design
- Implement consistent color schemes
- Use semantic class names

#### API Design

- Follow RESTful conventions
- Implement proper HTTP status codes
- Use consistent response formats
- Include proper error messages

This documentation provides a comprehensive foundation for developers working with CodeMind. Continue reading the following sections for detailed API documentation, user guides, and deployment instructions.