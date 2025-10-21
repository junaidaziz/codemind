# 📋 CodeMind - System Requirements & Dependencies

> **Last Updated:** January 21, 2025  
> **Version:** 2.0  
> **For:** Development & Production Deployment

---

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Required Dependencies](#required-dependencies)
3. [Environment Variables](#environment-variables)
4. [Database Requirements](#database-requirements)
5. [External Services](#external-services)
6. [Development Tools](#development-tools)
7. [Production Infrastructure](#production-infrastructure)
8. [Browser Support](#browser-support)

---

## 💻 System Requirements

### Minimum Requirements

**Operating System:**
- macOS 11+ (Big Sur or later)
- Windows 10/11 (with WSL2 recommended)
- Linux (Ubuntu 20.04+, Debian 11+, or equivalent)

**Hardware:**
- CPU: 2+ cores (4+ recommended)
- RAM: 4GB minimum (8GB+ recommended)
- Storage: 2GB free space (5GB+ recommended)
- Network: Stable internet connection for AI services

### Recommended Development Environment

**Hardware:**
- CPU: 4+ cores (Apple M1/M2 or Intel i5/AMD Ryzen 5+)
- RAM: 16GB
- Storage: 10GB+ SSD
- Network: High-speed internet (for AI API calls)

---

## 📦 Required Dependencies

### Runtime

**Node.js** (Required)
```bash
Version: 18.17.0 or higher (20.x recommended)
Check: node --version
Install: https://nodejs.org/
```

**pnpm** (Package Manager)
```bash
Version: 8.0.0 or higher
Check: pnpm --version
Install: npm install -g pnpm
Alternative: npm or yarn (adjust scripts accordingly)
```

### Core Framework

**Next.js**
```json
"next": "15.5.4"
```
- App Router architecture
- React Server Components
- API Routes
- Middleware support
- Turbopack for fast builds

**React**
```json
"react": "^19.0.0",
"react-dom": "^19.0.0"
```
- React 19 with latest features
- Concurrent rendering
- Suspense boundaries

**TypeScript**
```json
"typescript": "^5.7.3"
```
- Type safety across codebase
- Strict mode enabled
- Path aliases configured

### Database & ORM

**PostgreSQL**
```bash
Version: 14.0 or higher (15.x recommended)
Extensions Required:
  - pgvector (for vector similarity search)
  - pg_trgm (for text search)
Check: psql --version
```

**Prisma**
```json
"prisma": "^6.17.1",
"@prisma/client": "^6.17.1"
```
- Database migrations
- Type-safe queries
- Schema management

### AI & Machine Learning

**OpenAI API**
```json
"openai": "^4.96.0"
```
- GPT-4 Turbo for chat
- GPT-3.5 for fast responses
- text-embedding-ada-002 for vectors

**LangChain**
```json
"langchain": "^0.3.15",
"@langchain/community": "^0.3.25",
"@langchain/openai": "^0.3.17"
```
- Document processing
- RAG (Retrieval-Augmented Generation)
- Chain composition

### Authentication

**Supabase**
```json
"@supabase/supabase-js": "^2.50.1"
```
- User authentication
- JWT token management
- Session handling

**Jose** (JWT)
```json
"jose": "^5.10.2"
```
- JWT validation
- Token signing/verification

### UI Components

**Tailwind CSS**
```json
"tailwindcss": "^4.0.0"
```
- Utility-first CSS
- Custom configuration
- Dark mode support (coming soon)

**Shadcn UI Components**
```bash
Components used:
  - Button, Card, Input, Textarea
  - Dialog, DropdownMenu, Avatar
  - Tabs, Badge, Toast, Select
  - Accordion, Alert, Progress
  - Table, Tooltip, Popover
```

**Radix UI**
```json
"@radix-ui/react-*": "^1.x"
```
- Accessible primitives
- Unstyled components
- Keyboard navigation

### Data Visualization

**Recharts**
```json
"recharts": "^2.16.0"
```
- Charts and graphs
- Analytics dashboard
- Interactive visualizations

### Background Jobs (Optional)

**BullMQ** (with Redis)
```json
"bullmq": "^6.7.6",
"ioredis": "^5.4.2"
```
- Job queue management
- Background processing
- Progress tracking

**Redis**
```bash
Version: 6.2 or higher
Optional but recommended for production
Check: redis-cli --version
```

### File Processing

**Simple Git**
```json
"simple-git": "^3.27.0"
```
- Repository cloning
- Git operations
- Branch management

**Zod**
```json
"zod": "^3.24.1"
```
- Schema validation
- Runtime type checking
- API input validation

---

## 🔐 Environment Variables

### Required Variables

Create a `.env.local` file in the project root with these variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/codemind?schema=public"

# Supabase Authentication
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_JWT_SECRET="your-jwt-secret"

# OpenAI API
OPENAI_API_KEY="sk-your-api-key"

# GitHub Integration
GITHUB_TOKEN="ghp_your-personal-access-token"
GITHUB_WEBHOOK_SECRET="your-webhook-secret"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### Optional Variables

```bash
# Redis (for BullMQ)
REDIS_URL="redis://localhost:6379"

# Monitoring
SENTRY_DSN="your-sentry-dsn"

# Jira Integration (if using)
JIRA_API_TOKEN="your-jira-token"
JIRA_BASE_URL="https://your-domain.atlassian.net"
JIRA_EMAIL="your-email@example.com"

# Trello Integration (if using)
TRELLO_API_KEY="your-trello-key"
TRELLO_TOKEN="your-trello-token"
```

### GitHub Token Permissions

Your GitHub Personal Access Token needs these scopes:
- `repo` (full control of private repositories)
- `workflow` (update GitHub Actions workflows)
- `write:packages` (upload packages to GitHub Package Registry)
- `read:org` (read org and team membership)

---

## 🗄️ Database Requirements

### PostgreSQL Setup

**Installation:**
```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt-get install postgresql-15
sudo systemctl start postgresql

# Windows
Download from: https://www.postgresql.org/download/windows/
```

**pgvector Extension:**
```bash
# Install pgvector for vector similarity search
# macOS
brew install pgvector

# Ubuntu/Debian
sudo apt-get install postgresql-15-pgvector

# Enable in your database
psql -d codemind -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Database Schema

**Tables:** 15+ tables including:
- users, projects, messages, tools
- chunks (for code embeddings)
- jobs (for background processing)
- github_issues, github_prs
- project_analytics, activity_events

**Migrations:**
```bash
# Apply migrations
pnpm prisma migrate deploy

# Generate Prisma Client
pnpm prisma generate

# Seed database (optional)
pnpm prisma db seed
```

---

## 🌐 External Services

### Required Services

**1. Supabase** (Authentication & Database)
```
Website: https://supabase.com
Plan: Free tier works for development
Features Used:
  - PostgreSQL database with pgvector
  - Authentication (email, social)
  - JWT token management
```

**2. OpenAI API** (AI Services)
```
Website: https://platform.openai.com
Plan: Pay-per-use (API credits required)
Models Used:
  - gpt-4-turbo (primary chat)
  - gpt-3.5-turbo (fast responses)
  - text-embedding-ada-002 (vectors)
Average Cost: ~$20-50/month for moderate usage
```

**3. GitHub** (Version Control & Integration)
```
Website: https://github.com
Plan: Free tier works
Features Used:
  - Repository hosting
  - Issues and PRs
  - Webhooks
  - Personal Access Token
```

### Optional Services

**4. Vercel** (Hosting - Recommended)
```
Website: https://vercel.com
Plan: Free tier for hobby projects
Features:
  - Automatic deployments
  - Edge functions
  - Analytics
  - Preview deployments
```

**5. Redis Cloud** (for BullMQ)
```
Website: https://redis.com/try-free/
Plan: Free tier available
Use: Background job processing
```

**6. Sentry** (Error Tracking)
```
Website: https://sentry.io
Plan: Free tier available
Use: Error monitoring and tracking
```

---

## 🛠️ Development Tools

### Required Tools

**Code Editor:**
- VS Code (recommended) with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense
  - Prisma

**Git:**
```bash
Version: 2.30 or higher
Check: git --version
Install: https://git-scm.com/
```

### Recommended Tools

**API Testing:**
- Postman or Insomnia (for API endpoint testing)
- Thunder Client (VS Code extension)

**Database Management:**
- Prisma Studio (included): `pnpm prisma studio`
- TablePlus (macOS)
- pgAdmin (all platforms)
- DBeaver (all platforms)

**Terminal:**
- iTerm2 (macOS)
- Windows Terminal (Windows)
- Hyper (cross-platform)

---

## 🚀 Production Infrastructure

### Hosting Requirements

**Compute:**
- Node.js runtime environment
- Support for Next.js 15+ features
- Edge functions support (optional but recommended)
- Minimum 512MB RAM, 1 vCPU
- Recommended: 1GB RAM, 2 vCPU

**Database:**
- PostgreSQL 14+ with pgvector extension
- Minimum 1GB storage (5GB+ recommended)
- Connection pooling supported
- Backup strategy required

**Storage:**
- File storage for uploads (if not using cloud storage)
- Minimum 5GB (scales with usage)

### Recommended Production Stack

**Option 1: Vercel + Supabase (Easiest)**
```
Hosting: Vercel (Next.js optimized)
Database: Supabase (managed PostgreSQL)
Storage: Vercel Blob or Supabase Storage
Redis: Upstash Redis (optional)
Cost: ~$20-50/month
```

**Option 2: AWS (Most Flexible)**
```
Compute: AWS EC2 or ECS
Database: AWS RDS PostgreSQL
Storage: AWS S3
Redis: AWS ElastiCache
CDN: AWS CloudFront
Cost: ~$50-200/month
```

**Option 3: DigitalOcean (Balanced)**
```
Compute: DigitalOcean App Platform
Database: Managed PostgreSQL
Storage: Spaces (S3-compatible)
Redis: Managed Redis
Cost: ~$30-100/month
```

### Performance Requirements

**API Response Times:**
- Chat responses: < 3s (with streaming)
- Database queries: < 100ms
- Vector search: < 500ms
- Page load: < 2s

**Availability:**
- Uptime target: 99.9% (43 minutes downtime/month)
- Error rate: < 0.1%
- Concurrent users: 100+

---

## 🌍 Browser Support

### Supported Browsers

**Desktop:**
- Chrome/Edge 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Opera 76+ ✅

**Mobile:**
- iOS Safari 14+ ✅
- Chrome Mobile 90+ ✅
- Samsung Internet 14+ ✅

### Required Browser Features

- ES2020 JavaScript support
- WebSocket support (for real-time features)
- LocalStorage/SessionStorage
- Fetch API
- CSS Grid and Flexbox
- CSS Custom Properties

---

## 📋 Pre-Deployment Checklist

### Development Setup

- [ ] Node.js 18.17+ installed
- [ ] pnpm/npm/yarn installed
- [ ] PostgreSQL 14+ running
- [ ] pgvector extension enabled
- [ ] Redis running (optional)
- [ ] Git installed and configured
- [ ] VS Code with extensions
- [ ] Environment variables configured
- [ ] Database migrated and seeded

### Production Setup

- [ ] Hosting platform selected
- [ ] Database provisioned with backups
- [ ] Environment variables configured
- [ ] OpenAI API key with credits
- [ ] GitHub token with correct permissions
- [ ] Domain configured (if custom)
- [ ] SSL certificate enabled
- [ ] Error tracking setup (Sentry)
- [ ] Monitoring configured
- [ ] CI/CD pipeline setup

### Testing

- [ ] Local build succeeds: `pnpm build`
- [ ] TypeScript checks pass: `pnpm type-check`
- [ ] Linting passes: `pnpm lint`
- [ ] Unit tests pass: `pnpm test`
- [ ] E2E tests pass: `pnpm test:e2e`
- [ ] Chat functionality working
- [ ] GitHub integration working
- [ ] Smart Scaffolder working
- [ ] Database migrations applied
- [ ] API endpoints responding

---

## 🔄 Dependency Updates

### Update Strategy

**Major Updates:** Review changelog, test thoroughly  
**Minor Updates:** Safe to update, test basic functionality  
**Patch Updates:** Usually safe, apply regularly

**Update Commands:**
```bash
# Check for updates
pnpm outdated

# Update all dependencies
pnpm update

# Update specific package
pnpm update package-name

# Update Prisma
pnpm prisma generate
```

### Known Compatibility Issues

**Next.js 15.x:**
- Requires React 19+
- App Router only (Pages Router deprecated)
- Turbopack required for optimal performance

**React 19:**
- New hooks API (use, useActionState, etc.)
- Server Components by default
- Some third-party libraries may not be compatible yet

---

## 📞 Support & Resources

### Getting Help

**Documentation:**
- README.md - Quick start guide
- FEATURES.md - Complete feature list
- docs/ - Detailed documentation

**Troubleshooting:**
- Check environment variables
- Verify database connection
- Check API key validity
- Review browser console
- Check server logs

**Community:**
- GitHub Issues: Report bugs
- GitHub Discussions: Ask questions
- Email: support@codemind.dev

---

**Last Updated:** January 21, 2025  
**Maintained by:** Junaid Aziz and the CodeMind team
