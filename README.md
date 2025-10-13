# CodeMind

An intelligent code understanding and chat platform that helps developers explore, understand, and work with codebases through natural language interactions.

## 🚀 Features

- **Intelligent Code Indexing**: Automatically processes and indexes codebases for fast, semantic search
- **AI-Powered Chat**: Natural language interactions with your codebase using advanced language models
- **Project Management**: Organize and manage multiple code projects with comprehensive analytics
- **Real-time Collaboration**: Share insights and collaborate with team members
- **Advanced Analytics**: Monitor usage patterns, system performance, and user engagement
- **Role-Based Access Control**: Granular permissions and user management system
- **Background Processing**: Efficient handling of large codebases with queue-based processing

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL with Prisma ORM, pgvector extension for embeddings
- **Authentication**: Supabase Auth with role-based access control
- **AI/ML**: OpenAI GPT models, LangChain for document processing
- **Analytics**: Custom analytics service with Recharts visualization
- **Monitoring**: Sentry for error tracking, custom logging system
- **Infrastructure**: Background job processing with queue management

## 📚 Documentation

- **[Getting Started Guide](docs/README.md)** - Complete setup and development guide
- **[API Documentation](docs/API.md)** - Comprehensive API reference
- **[User Guide](docs/USER_GUIDE.md)** - How to use CodeMind effectively
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL database with pgvector extension
- Supabase account for authentication
- OpenAI API key for AI features

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/codemind.git
   cd codemind
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.production.template .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database:**
   ```bash
   pnpm prisma generate
   pnpm prisma migrate deploy
   ```

5. **Start the development server:**
   ```bash
   pnpm dev
   ```

6. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🤖 Agent Service Deployment

CodeMind now supports a standalone agent service for improved scalability and performance:

### Quick Agent Service Setup

1. **Start the agent service:**
   ```bash
   ./scripts/start-agent-service.sh
   ```

2. **Enable standalone agent in web app:**
   ```bash
   # Add to your .env.local
   ENABLE_STANDALONE_AGENT=true
   AGENT_SERVICE_URL=http://localhost:3001
   ```

3. **Validate deployment:**
   ```bash
   ./scripts/validate-deployment.sh
   ```

### Docker Deployment

```bash
# Build and run with Docker Compose
cd services/agent-core
docker-compose up -d

# Check service health
curl http://localhost:3001/health
```

### Features

- **Independent Scaling**: Deploy and scale AI processing separately from web app
- **Rate Limiting**: Built-in concurrency controls and rate limiting
- **Health Monitoring**: Comprehensive health checks and metrics
- **Fallback Support**: Automatic fallback to local agent if service unavailable
- **Production Ready**: Docker containerization with security best practices

For detailed setup instructions, see [services/agent-core/README.md](services/agent-core/README.md).

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API routes (auth, projects, chat, analytics)
│   ├── auth/           # Authentication pages
│   ├── chat/           # Chat interface
│   ├── projects/       # Project management
│   ├── analytics/      # Analytics dashboard
│   ├── components/     # App-specific components
│   └── lib/            # App utilities and services
├── components/         # Reusable React components
│   ├── ui/            # Base UI components
│   └── charts/        # Chart components with Recharts
├── lib/               # Shared utilities and services
├── types/             # TypeScript type definitions
└── styles/            # Global styles

prisma/
├── schema.prisma      # Database schema
├── migrations/        # Database migrations
└── seed.ts           # Database seeding

docs/                  # Documentation
├── README.md          # Complete documentation
├── API.md            # API reference
├── USER_GUIDE.md     # User guide
└── DEPLOYMENT.md     # Deployment guide
```

## ⚡ Development

### Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm dev:turbo        # Start with Turbopack (faster)
pnpm build            # Build for production
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm type-check       # Run TypeScript checks
pnpm format           # Format code with Prettier

# Database
pnpm prisma studio    # Open database GUI
pnpm prisma generate  # Generate Prisma client
pnpm prisma migrate   # Create and apply migration
pnpm prisma db seed   # Seed the database

# Testing
pnpm test             # Run unit tests
pnpm test:watch       # Run tests in watch mode
pnpm test:e2e         # Run end-to-end tests
```

### Environment Configuration

Key environment variables needed:

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

# Background Jobs
REDIS_URL="redis://localhost:6379"

# Monitoring (Optional)
SENTRY_DSN="your-sentry-dsn"
```

## 🎯 Key Features Implemented

### ✅ Authentication & Authorization
- Subabase Auth integration with JWT tokens
- Role-based access control (RBAC) with user, admin, super_admin roles
- Protected routes and API endpoints
- Session management and token refresh

### ✅ Project Management
- Git repository integration and file upload
- Background indexing with job queue processing
- Project status tracking and progress monitoring
- File chunking and semantic search with pgvector

### ✅ AI-Powered Chat
- Natural language conversations with codebases
- Context-aware responses using RAG (Retrieval-Augmented Generation)
- Chat session management and history
- Source code references and citations

### ✅ Analytics Dashboard
- Real-time usage metrics and system performance
- Interactive charts with Recharts integration
- User activity tracking and project analytics
- System health monitoring and alerts

### ✅ Background Processing
- Redis-based job queue for heavy operations
- Document indexing and embedding generation
- Progress tracking and error handling
- Scalable processing architecture

### ✅ Monitoring & Logging
- Comprehensive logging system with structured data
- Sentry integration for error tracking
- Performance monitoring and request timing
- Analytics event tracking

## 🚦 Getting Help

- **Documentation**: Check our comprehensive [documentation](docs/)
- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/yourusername/codemind/issues)
- **Discussions**: Join conversations on [GitHub Discussions](https://github.com/yourusername/codemind/discussions)
- **Support**: Contact us at support@codemind.dev

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Read our [Contributing Guide](CONTRIBUTING.md)**
2. **Fork the repository** and create a feature branch
3. **Make your changes** following our coding standards
4. **Write tests** for new functionality
5. **Submit a pull request** with a clear description

### Development Workflow

1. **Fork and clone** the repository
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and commit: `git commit -m 'feat: add amazing feature'`
4. **Push to your fork**: `git push origin feature/amazing-feature`
5. **Create a Pull Request** on GitHub

## 📊 Project Status

CodeMind is actively under development with the following milestones completed:

- ✅ **Authentication System** - Supabase Auth with RBAC
- ✅ **Project Management** - Git integration and file handling
- ✅ **AI Chat Interface** - Natural language code conversations
- ✅ **Analytics Dashboard** - Usage metrics and performance monitoring
- ✅ **Background Processing** - Job queue and async operations
- ✅ **Monitoring & Logging** - Error tracking and performance monitoring
- ✅ **Documentation** - Comprehensive guides and API docs
- 🏗️ **Testing Framework** - Unit and E2E testing setup (in progress)
- 🏗️ **CI/CD Pipeline** - Automated testing and deployment (in progress)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Next.js team** for the amazing full-stack React framework
- **Supabase** for providing excellent authentication and database services
- **OpenAI** for advanced language models that power our AI features
- **Prisma** for the type-safe database toolkit
- **Vercel** for deployment and hosting solutions

## 📧 Contact

- **Email**: support@codemind.dev
- **GitHub**: [https://github.com/yourusername/codemind](https://github.com/yourusername/codemind)
- **Website**: [https://codemind.dev](https://codemind.dev)

---

**Made with ❤️ by the CodeMind team**
