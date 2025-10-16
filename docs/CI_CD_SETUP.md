# CI/CD Setup Guide

## Overview

CodeMind uses a comprehensive CI/CD pipeline combining GitHub Actions and Vercel for automated testing, security scanning, and deployments with intelligent auto-fix capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Code Changes                         │
│              (Push/PR to GitHub)                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              GitHub Actions Workflow                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  Quality │  │  Tests   │  │   E2E    │             │
│  │ (ESLint, │  │ (Jest +  │  │(Playwright)│            │
│  │   TSC)   │  │ Coverage)│  │          │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                          │
│  ┌──────────┐  ┌─────────────────────────┐             │
│  │  Build   │  │     Security Scan       │             │
│  │ (Docker) │  │  (Snyk, Trivy, Audit)  │             │
│  └──────────┘  └─────────────────────────┘             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                Vercel Deployment                         │
│                                                          │
│  ┌──────────────┐       ┌──────────────┐               │
│  │   Staging    │       │  Production  │               │
│  │(auto-deploy) │       │(main branch) │               │
│  └──────────────┘       └──────────────┘               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Deployment Monitoring                         │
│                                                          │
│  ┌────────────────┐      ┌────────────────┐            │
│  │ Webhook Event  │      │  Log Fetcher   │            │
│  │  (Real-time)   │      │  (Scheduled)   │            │
│  └────────┬───────┘      └────────┬───────┘            │
│           │                       │                     │
│           └───────────┬───────────┘                     │
│                       ▼                                 │
│              ┌─────────────────┐                        │
│              │  Auto-Fix API   │                        │
│              │   (AI-Powered)  │                        │
│              └─────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. GitHub Actions Workflow
**File:** `.github/workflows/ci-cd.yml`

#### Jobs

##### Quality Job
- **Purpose:** Code quality checks
- **Runs on:** `ubuntu-latest`
- **Node version:** 20.x
- **Steps:**
  1. Install dependencies (`pnpm install`)
  2. Run ESLint (`npm run lint`)
  3. Run TypeScript type check (`npm run type-check`)
  4. Run security audit (`npm audit`)
- **Triggers:** All pushes and PRs

##### Test Job
- **Purpose:** Unit and integration tests
- **Runs on:** `ubuntu-latest`
- **Node versions:** 18.x, 20.x (matrix)
- **Steps:**
  1. Setup PostgreSQL database
  2. Run database migrations
  3. Run Jest tests with coverage (`npm run test:coverage`)
  4. Upload coverage to Codecov
- **Triggers:** All pushes and PRs

##### E2E Job
- **Purpose:** End-to-end testing
- **Runs on:** `ubuntu-latest`
- **Dependencies:** quality, test jobs
- **Steps:**
  1. Install Playwright browsers
  2. Setup test database
  3. Run E2E tests (`npm run test:e2e`)
  4. Upload test artifacts on failure
- **Triggers:** All pushes and PRs

##### Build Job
- **Purpose:** Docker build and security scanning
- **Runs on:** `ubuntu-latest`
- **Dependencies:** quality, test, e2e jobs
- **Steps:**
  1. Build Docker image
  2. Run Snyk vulnerability scan
  3. Run Trivy container scan
  4. Push image to registry (on main branch)
- **Triggers:** All pushes and PRs

##### Deploy-Staging Job
- **Purpose:** Automatic deployment to staging
- **Runs on:** `ubuntu-latest`
- **Dependencies:** build job
- **Steps:**
  1. Deploy to Vercel (staging environment)
  2. Run smoke tests
  3. Send notification
- **Triggers:** Pushes to non-main branches

##### Deploy-Production Job
- **Purpose:** Production deployment
- **Runs on:** `ubuntu-latest`
- **Dependencies:** build job
- **Environment:** production (requires approval)
- **Steps:**
  1. Run database migrations
  2. Deploy to Vercel (production)
  3. Run smoke tests
  4. Send success notification
- **Triggers:** Pushes to main branch

##### Migrate-DB Job
- **Purpose:** Database schema migrations
- **Runs on:** `ubuntu-latest`
- **Steps:**
  1. Run Prisma migrations (`npx prisma migrate deploy`)
  2. Generate Prisma client
  3. Validate schema
- **Triggers:** Manual or before production deploy

### 2. Vercel Integration

CodeMind uses Vercel for application hosting with automated deployment monitoring. See [VERCEL_INTEGRATION.md](./VERCEL_INTEGRATION.md) for detailed setup.

#### Key Features
- ✅ Real-time webhook notifications for deployment events
- ✅ Automated log fetching and analysis
- ✅ Intelligent auto-fix triggering on failures
- ✅ Deployment health monitoring

### 3. Auto-Fix System

#### Flow
```
Build Failure Detected
        ↓
Logs Analyzed (AI)
        ↓
Root Cause Identified
        ↓
Fix Generated
        ↓
PR Created
        ↓
CI/CD Triggered
        ↓
Auto-merge (if tests pass)
```

#### Trigger Types
1. **Webhook (Real-time):** Vercel sends webhook on deployment failure
2. **Scheduled (Proactive):** Cron job checks for failures hourly
3. **Manual (On-demand):** Developer runs log fetcher script

## Setup Instructions

### Prerequisites

1. **GitHub Repository**
   - Repository with admin access
   - GitHub Actions enabled

2. **Vercel Account**
   - Project created and linked to repository
   - API token generated

3. **Required Services**
   - PostgreSQL database (Supabase)
   - OpenAI API access
   - GitHub App created (for auto-fix PRs)

### Step 1: Environment Variables

Create `.env.local` with all required variables:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"
DIRECT_URL="postgresql://user:pass@host:5432/db"

# Supabase
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="your_anon_key"

# GitHub
GITHUB_TOKEN="ghp_your_personal_access_token"
GITHUB_APP_ID="123456"
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET="your_webhook_secret"

# Vercel
VERCEL_TOKEN="your_vercel_token"
VERCEL_PROJECT_ID="prj_xxxxx"
VERCEL_TEAM_ID="team_xxxxx"
VERCEL_WEBHOOK_SECRET="your_vercel_webhook_secret"

# OpenAI
OPENAI_API_KEY="sk-proj-xxx"

# JWT
JWT_SECRET="your_jwt_secret_minimum_32_chars"
NEXTAUTH_SECRET="your_nextauth_secret"
NEXTAUTH_URL="http://localhost:3000"

# Application
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NODE_ENV="production"
```

### Step 2: GitHub Secrets

Add secrets to GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add the following secrets:
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `GITHUB_TOKEN`
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`
   - `VERCEL_TOKEN`
   - `VERCEL_PROJECT_ID`
   - `OPENAI_API_KEY`
   - `JWT_SECRET`
   - `CODECOV_TOKEN` (from codecov.io)

### Step 3: Vercel Configuration

1. **Link Repository:**
   ```bash
   vercel link
   ```

2. **Add Environment Variables:**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add all variables from `.env.local`
   - Set appropriate environments (Production, Preview, Development)

3. **Setup Webhook:**
   - Go to Project Settings → Webhooks
   - Click "Add Webhook"
   - URL: `https://your-domain.com/api/webhooks/vercel-deployment`
   - Events: `deployment.created`, `deployment.succeeded`, `deployment.failed`, `deployment.error`
   - Secret: Use `VERCEL_WEBHOOK_SECRET` value

### Step 4: Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npm run db:seed

# Verify connection
npm run test:db
```

### Step 5: GitHub Actions Configuration

The workflow file (`.github/workflows/ci-cd.yml`) is already configured. Verify:

1. **Branch Protection Rules:**
   - Go to Settings → Branches → Add rule
   - Branch name pattern: `main`
   - Enable:
     - Require status checks to pass
     - Require branches to be up to date
     - Status checks: `quality`, `test`, `e2e`, `build`

2. **Environments:**
   - Go to Settings → Environments
   - Create `production` environment
   - Add protection rules:
     - Required reviewers (1-2 people)
     - Wait timer (optional)

### Step 6: Testing

#### Local Testing
```bash
# Install dependencies
pnpm install

# Run all checks locally
npm run lint
npm run type-check
npm run test
npm run test:e2e
npm run build

# Test Vercel integration
npm run fetch-vercel-logs:errors
```

#### CI/CD Testing
```bash
# Create test branch
git checkout -b test/ci-cd

# Trigger workflow
git commit --allow-empty -m "test: CI/CD pipeline"
git push origin test/ci-cd

# Check workflow status
# Go to: https://github.com/your-org/codemind/actions
```

## Monitoring

### GitHub Actions Dashboard
- URL: `https://github.com/your-org/codemind/actions`
- Shows all workflow runs, job statuses, logs

### Vercel Dashboard
- URL: `https://vercel.com/your-team/codemind`
- Shows deployments, build logs, runtime logs

### Codecov Dashboard
- URL: `https://app.codecov.io/gh/your-org/codemind`
- Shows test coverage trends, file coverage

### Auto-Fix Sessions
- API: `https://your-domain.com/api/auto-fix/sessions`
- Dashboard: `https://your-domain.com/dashboard/auto-fix`

## Maintenance

### Regular Tasks

#### Weekly
- [ ] Review failed workflow runs
- [ ] Check test coverage trends
- [ ] Review auto-fix success rates
- [ ] Update dependencies (dependabot PRs)

#### Monthly
- [ ] Review and update CI/CD workflow
- [ ] Audit security scan results
- [ ] Optimize build times
- [ ] Review and clean up old deployments

### Updating Dependencies

```bash
# Check for outdated packages
pnpm outdated

# Update safely (patch/minor only)
pnpm update

# Update major versions (carefully)
pnpm update --latest

# Test after updates
npm run test:all
```

### Workflow Optimization

1. **Reduce Build Time:**
   - Use caching effectively (npm cache, build cache)
   - Run jobs in parallel when possible
   - Skip unnecessary steps on certain conditions

2. **Improve Test Performance:**
   - Use test.concurrent for independent tests
   - Split E2E tests into multiple jobs
   - Use test sharding for large test suites

3. **Optimize Docker Builds:**
   - Use multi-stage builds
   - Leverage layer caching
   - Minimize image size

## Troubleshooting

### Common Issues

#### 1. Tests Failing in CI but Passing Locally
**Symptoms:** Green tests locally, red in GitHub Actions

**Solutions:**
- Check Node version matches (use matrix: `18.x, 20.x`)
- Verify environment variables are set in GitHub Secrets
- Check database connection (ensure `DATABASE_URL` is correct)
- Review CI logs for specific error messages

#### 2. Build Timing Out
**Symptoms:** Build job exceeds time limit

**Solutions:**
- Optimize dependencies (remove unused packages)
- Use build caching
- Consider splitting build into multiple jobs
- Review Docker build steps

#### 3. Vercel Deployment Fails
**Symptoms:** CI passes but Vercel deployment fails

**Solutions:**
- Check Vercel build logs
- Verify environment variables in Vercel dashboard
- Test build locally: `npm run build`
- Check for missing dependencies in `package.json`

#### 4. Auto-Fix Not Triggering
**Symptoms:** Webhook received but no auto-fix session created

**Solutions:**
- Check webhook signature verification
- Verify `VERCEL_WEBHOOK_SECRET` matches Vercel config
- Review application logs for errors
- Test auto-fix API directly: `curl -X POST https://your-domain.com/api/github/auto-fix`

#### 5. Coverage Upload Fails
**Symptoms:** Codecov step fails in workflow

**Solutions:**
- Verify `CODECOV_TOKEN` is set in GitHub Secrets
- Check coverage report is generated: `coverage/lcov.info`
- Review Codecov API status
- Try re-running the job

### Debug Commands

```bash
# Check workflow syntax
gh workflow view ci-cd.yml

# List workflow runs
gh run list --workflow=ci-cd.yml

# View specific run
gh run view <run-id>

# Download logs
gh run download <run-id>

# Re-run failed jobs
gh run rerun <run-id> --failed

# Test Vercel deployment locally
vercel --prod

# Check Vercel logs
vercel logs <deployment-url>

# Test database connection
npm run test:db

# Validate Prisma schema
npx prisma validate
```

## Security Best Practices

### Secrets Management
- ✅ Never commit secrets to repository
- ✅ Use GitHub Secrets for CI/CD
- ✅ Use Vercel Environment Variables for deployments
- ✅ Rotate secrets regularly (quarterly)
- ✅ Use different secrets for staging/production

### Code Security
- ✅ Run security audit in CI (`npm audit`)
- ✅ Scan dependencies (Snyk)
- ✅ Scan Docker images (Trivy)
- ✅ Review Dependabot alerts weekly
- ✅ Enable CodeQL analysis

### Access Control
- ✅ Limit GitHub Actions permissions (use `permissions` block)
- ✅ Require approval for production deployments
- ✅ Use branch protection rules
- ✅ Enable 2FA for all team members
- ✅ Review access logs regularly

## Performance Metrics

### Target Metrics
- **Build Time:** < 5 minutes
- **Test Time:** < 3 minutes
- **E2E Test Time:** < 5 minutes
- **Total Pipeline Time:** < 15 minutes
- **Test Coverage:** > 80%
- **Auto-Fix Success Rate:** > 70%

### Current Status
Check live metrics at:
- GitHub Actions: `.github/workflows/ci-cd.yml` runs
- Codecov: Coverage reports
- Vercel: Build analytics
- Application: `/dashboard/metrics`

## Resources

### Documentation
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Vercel Docs](https://vercel.com/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [Playwright Docs](https://playwright.dev/docs/intro)

### Internal Docs
- [Vercel Integration Guide](./VERCEL_INTEGRATION.md)
- [Testing Guide](./TESTING.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)

### Support
- **Team Lead:** @team-lead
- **DevOps:** @devops-team
- **Issues:** GitHub Issues
- **Slack:** #codemind-ci-cd

---

**Last Updated:** 16 October 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
