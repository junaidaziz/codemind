# Testing & Deployment Guide

## Testing Framework

### Overview
This project uses a comprehensive testing setup with:
- **Jest** for unit and integration tests
- **React Testing Library** for component testing
- **Playwright** for end-to-end testing
- **MSW (Mock Service Worker)** for API mocking

### Running Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run all tests (unit + E2E)
npm run test:all
```

### Test Structure

```
src/
├── __tests__/                 # Global test utilities
├── components/__tests__/      # Component tests
├── app/api/__tests__/        # API route tests
├── lib/__tests__/            # Utility function tests
└── test-utils/               # Testing utilities and helpers

tests/
├── e2e/                      # End-to-end tests
├── integration/              # Integration tests
└── fixtures/                 # Test fixtures and data
```

### Writing Tests

#### Component Tests
```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

#### API Tests
```typescript
import { GET, POST } from '../route';

describe('/api/example', () => {
  it('handles GET requests', async () => {
    const response = await GET();
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

#### E2E Tests
```typescript
import { test, expect } from '@playwright/test';

test('user can navigate to projects', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="projects-link"]');
  await expect(page).toHaveURL('/projects');
});
```

### Test Configuration

#### Jest Configuration (`jest.config.js`)
- Next.js integration with `next/jest`
- TypeScript support
- Module path mapping
- Coverage thresholds (70% minimum)
- Custom test environment setup

#### Playwright Configuration (`playwright.config.ts`)
- Multi-browser testing (Chromium, Firefox, Safari)
- Mobile viewport testing
- Parallel test execution
- Screenshot and video capture on failure
- CI/CD integration settings

### Coverage Requirements

Minimum coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## CI/CD Pipeline

### Overview
The CI/CD pipeline uses GitHub Actions with multiple stages:

1. **Code Quality & Security**
2. **Unit & Integration Tests**
3. **End-to-End Tests**
4. **Build & Security Scan**
5. **Deploy to Staging**
6. **Deploy to Production**
7. **Database Migration**

### Pipeline Stages

#### 1. Code Quality & Security
- ESLint code linting
- TypeScript type checking
- Security audit with npm audit
- Dependency vulnerability scanning

#### 2. Testing
- Unit tests across Node.js 18 and 20
- Integration tests
- Test coverage reporting
- Coverage upload to Codecov

#### 3. E2E Testing
- Playwright browser testing
- Cross-browser compatibility
- Visual regression testing
- Performance testing

#### 4. Build & Security
- Production build
- Docker image creation
- Container security scanning with Trivy
- Dependency scanning with Snyk

#### 5. Deployment
- **Staging**: Auto-deploy on `develop` branch
- **Production**: Auto-deploy on `main` branch
- Smoke tests after deployment
- Rollback capabilities

### Required Secrets

Configure these secrets in your GitHub repository:

```bash
# Vercel Deployment
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-vercel-org-id
VERCEL_PROJECT_ID=your-vercel-project-id

# Database
PRODUCTION_DATABASE_URL=your-production-db-url

# Security Scanning
SNYK_TOKEN=your-snyk-token
CODECOV_TOKEN=your-codecov-token

# Notifications
SLACK_WEBHOOK_URL=your-slack-webhook
```

### Deployment Environments

#### Staging Environment
- **URL**: Auto-generated Vercel preview URL
- **Database**: Staging database instance
- **Purpose**: Final testing before production
- **Auto-deploy**: On push to `develop` branch

#### Production Environment
- **URL**: https://your-domain.com
- **Database**: Production database
- **Purpose**: Live application
- **Auto-deploy**: On push to `main` branch
- **Manual approval**: Required for production deployments

## Docker Deployment

### Local Development with Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Rebuild services
docker-compose up --build
```

### Services Included

- **App**: Next.js application
- **PostgreSQL**: Database
- **Redis**: Caching and sessions
- **Qdrant**: Vector database for embeddings
- **Prometheus**: Metrics collection
- **Grafana**: Monitoring dashboard
- **Loki**: Log aggregation
- **Traefik**: Reverse proxy and load balancer

### Production Docker Deployment

```bash
# Build production image
docker build -t codemind:latest .

# Run production container
docker run -d \
  --name codemind \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=your-db-url \
  codemind:latest
```

## Monitoring & Observability

### Health Checks
- **Endpoint**: `/api/health`
- **Checks**: Database, Redis, External APIs
- **Response**: JSON with service status and metrics

### Logging
- Structured logging with Winston
- Log levels: error, warn, info, debug
- Request/response logging
- Performance metrics

### Metrics
- **Prometheus**: System and application metrics
- **Grafana**: Visualization and alerting
- **Custom metrics**: Business KPIs and performance

### Error Tracking
- **Sentry**: Error monitoring and reporting
- **Source maps**: For production debugging
- **User context**: For better error reporting

## Performance Testing

### Load Testing
```bash
# Install k6
npm install -g k6

# Run load tests
k6 run tests/performance/load-test.js
```

### Performance Monitoring
- **Web Vitals**: Core Web Vitals tracking
- **Performance API**: Browser performance metrics
- **Lighthouse CI**: Automated performance audits

## Security

### Security Scanning
- **Snyk**: Dependency vulnerability scanning
- **Trivy**: Container security scanning
- **OWASP ZAP**: Dynamic security testing

### Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Session management
- Password policies

## Troubleshooting

### Common Issues

#### Test Failures
```bash
# Clear Jest cache
npm test -- --clearCache

# Run specific test file
npm test -- MyComponent.test.tsx

# Run tests with verbose output
npm test -- --verbose
```

#### Build Issues
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Docker Issues
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

### Getting Help

1. Check the [troubleshooting guide](./docs/TROUBLESHOOTING.md)
2. Review the [FAQ](./docs/FAQ.md)
3. Search existing [GitHub issues](https://github.com/your-org/codemind/issues)
4. Create a new issue with:
   - Environment details
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs/screenshots

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Setting up development environment
- Running tests locally
- Submitting pull requests
- Code review process