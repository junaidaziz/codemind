# CI/CD Pipeline Documentation

This document describes the comprehensive CI/CD pipeline for CodeMind, including automated testing, building, security scanning, and deployment processes.

## Pipeline Overview

The CI/CD pipeline is implemented using GitHub Actions and consists of the following stages:

1. **Code Quality & Security**
2. **Unit & Integration Tests**
3. **End-to-End Tests**
4. **Build & Security Scan**
5. **Deploy to Staging**
6. **Deploy to Production**
7. **Database Migration**

## Pipeline Triggers

- **Push to `main`**: Triggers full pipeline including production deployment
- **Push to `develop`**: Triggers full pipeline including staging deployment
- **Pull Request to `main`**: Triggers quality checks and tests (no deployment)

## Detailed Stage Breakdown

### 1. Code Quality & Security

**Purpose**: Ensure code quality and identify security issues early

**Steps**:
- ESLint for code quality and consistency
- TypeScript type checking
- Security audit using `npm audit`
- Dependency vulnerability scanning

**Configuration**:
```yaml
- name: Run ESLint
  run: pnpm lint
  continue-on-error: true

- name: Security audit
  run: pnpm audit --audit-level high
  continue-on-error: true
```

### 2. Unit & Integration Tests

**Purpose**: Validate functionality through automated testing

**Features**:
- Matrix testing across Node.js versions (18, 20)
- Test coverage reporting
- Coverage upload to Codecov
- Parallel execution for faster feedback

**Configuration**:
```yaml
strategy:
  matrix:
    node-version: ['18', '20']

- name: Run unit tests
  run: pnpm test
  env:
    NODE_ENV: test

- name: Generate test coverage
  run: pnpm test:coverage
```

### 3. End-to-End Tests

**Purpose**: Validate complete user workflows

**Features**:
- Playwright for browser automation
- Cross-browser testing
- Visual regression testing
- Test artifacts upload on failure

**Configuration**:
```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: pnpm test:e2e
  env:
    BASE_URL: http://localhost:3000
```

### 4. Build & Security Scan

**Purpose**: Create production builds and scan for vulnerabilities

**Features**:
- Next.js production build
- Docker image creation
- Container security scanning with Trivy
- Dependency scanning with Snyk
- SARIF report upload to GitHub Security

**Configuration**:
```yaml
- name: Build Docker image
  run: |
    docker build -t codemind:${{ github.sha }} .
    docker tag codemind:${{ github.sha }} codemind:latest

- name: Run container security scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'codemind:${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
```

### 5. Deploy to Staging

**Purpose**: Deploy to staging environment for testing

**Triggers**: Push to `develop` branch

**Features**:
- Automatic deployment to Vercel staging
- Smoke tests on deployed application
- Environment-specific configuration

**Configuration**:
```yaml
- name: Deploy to Vercel (Staging)
  uses: amondnet/vercel-action@v25
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### 6. Deploy to Production

**Purpose**: Deploy to production environment

**Triggers**: Push to `main` branch

**Features**:
- Production deployment to Vercel
- Production smoke tests
- Slack notifications for deployment status
- Manual approval required (GitHub environment protection)

**Configuration**:
```yaml
environment: production

- name: Deploy to Vercel (Production)
  uses: amondnet/vercel-action@v25
  with:
    vercel-args: '--prod'
```

### 7. Database Migration

**Purpose**: Apply database schema changes

**Triggers**: After successful production deployment

**Features**:
- Prisma migration deployment
- Database health verification
- Rollback capabilities

**Configuration**:
```yaml
- name: Run database migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

## Required Secrets

Configure the following secrets in GitHub repository settings:

### Deployment
- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID

### Database
- `PRODUCTION_DATABASE_URL`: Production database connection string

### Security & Monitoring
- `SNYK_TOKEN`: Snyk security scanning token
- `CODECOV_TOKEN`: Code coverage reporting token
- `SLACK_WEBHOOK_URL`: Slack notifications webhook

### Application Environment Variables
- `OPENAI_API_KEY`: OpenAI API key for production
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SENTRY_DSN`: Sentry error tracking DSN

## Environment Configuration

### Staging Environment
- **URL**: Automatically generated Vercel preview URL
- **Database**: Staging database instance
- **Features**: Full feature set with test data

### Production Environment
- **URL**: Custom domain (configured in Vercel)
- **Database**: Production database with backups
- **Features**: Full feature set with real data
- **Monitoring**: Complete observability stack

## Quality Gates

The pipeline includes several quality gates that must pass:

1. **Code Quality**: ESLint must pass with no errors
2. **Type Safety**: TypeScript compilation must succeed
3. **Test Coverage**: Minimum 70% code coverage required
4. **Security**: No high-severity vulnerabilities
5. **Build**: Production build must succeed
6. **E2E Tests**: All end-to-end tests must pass

## Monitoring & Observability

### Test Results
- Unit test results in GitHub Actions
- Coverage reports in Codecov
- E2E test artifacts stored for failed runs

### Security Monitoring
- Vulnerability scanning results in GitHub Security tab
- Dependency update notifications
- Container security scan results

### Deployment Monitoring
- Deployment status in Slack notifications
- Application health checks post-deployment
- Performance monitoring with Sentry

## Local Development & Testing

### Running Pipeline Locally

Use the validation script to run similar checks locally:

```bash
# Make script executable
chmod +x scripts/validate-ci-cd.sh

# Run validation
./scripts/validate-ci-cd.sh
```

### Individual Commands

```bash
# Code quality
npm run lint
npx tsc --noEmit

# Testing
npm test
npm run test:coverage
npm run test:e2e

# Building
npm run build
docker build -t codemind .

# Security
npm audit --audit-level high
```

## Troubleshooting

### Common Issues

1. **Test Failures**
   - Check test output in GitHub Actions logs
   - Run tests locally: `npm test`
   - Update snapshots if needed: `npm run test -- -u`

2. **Build Failures**
   - Check TypeScript errors: `npx tsc --noEmit`
   - Verify dependencies: `npm install`
   - Check environment variables

3. **Deployment Failures**
   - Verify Vercel configuration
   - Check secrets are properly set
   - Validate environment variables

4. **Security Scan Failures**
   - Review vulnerability reports
   - Update dependencies: `npm update`
   - Use `npm audit fix` for automatic fixes

### Debug Mode

Enable debug logging in GitHub Actions:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

## Performance Optimization

### Pipeline Speed
- Parallel job execution
- Dependency caching
- Docker layer caching
- Test sharding

### Resource Usage
- Matrix builds only for critical paths
- Conditional job execution
- Artifact cleanup
- Optimized Docker images

## Best Practices

1. **Branch Protection**: Require PR reviews and status checks
2. **Secret Management**: Use GitHub secrets for sensitive data
3. **Environment Separation**: Separate staging and production environments
4. **Rollback Strategy**: Maintain rollback capabilities
5. **Monitoring**: Monitor pipeline performance and success rates

## Future Enhancements

- [ ] Blue-green deployment strategy
- [ ] Canary deployments
- [ ] Performance testing integration
- [ ] Infrastructure as Code (IaC)
- [ ] Multi-cloud deployment support
- [ ] Advanced security scanning
- [ ] Automated dependency updates

## Support

For pipeline issues:
1. Check GitHub Actions logs
2. Review this documentation
3. Contact the development team
4. Create an issue in the repository

---

This CI/CD pipeline ensures high-quality, secure, and reliable deployments for CodeMind while maintaining developer productivity and system reliability.