# CodeMind Testing Infrastructure

## Comprehensive Testing Setup for CodeMind

This document describes the complete testing infrastructure for CodeMind, including unit tests, integration tests, multi-project analytics testing, deployment verification, and security validation.

## 🚀 Quick Start

```bash
# Run all comprehensive tests
./scripts/run-tests.sh all-tests

# Run specific test suites
./scripts/run-tests.sh multi-project
./scripts/run-tests.sh verify-staging
./scripts/run-tests.sh github-integration
```

## Testing Stack

- **Unit Testing**: Jest with @testing-library/react
- **Integration Testing**: Jest with API route testing  
- **E2E Testing**: Playwright for full browser automation
- **Multi-Project Testing**: Custom TypeScript testing framework
- **Deployment Verification**: Environment validation system
- **Security Testing**: RBAC and field masking validation
- **Test Database**: PostgreSQL with test-specific configuration
- **Mocking**: MSW (Mock Service Worker) for API mocking
- **Coverage**: Built-in Jest coverage reporting

## Configuration Files

### Jest Configuration
- `jest.config.js` - Main Jest configuration
- `jest.setup.js` - Test setup and global mocks
- `__mocks__/` - Manual mocks for external dependencies

### Playwright Configuration
- `playwright.config.ts` - E2E testing configuration
- `tests/e2e/` - End-to-end test files
- `tests/fixtures/` - Test fixtures and data

### Test Utilities
- `src/test-utils/` - Custom testing utilities and wrappers
- `src/__mocks__/` - Application-specific mocks

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── components/         # Component tests
│   ├── lib/               # Utility function tests
│   └── types/             # Type validation tests
├── integration/            # Integration tests
│   ├── api/               # API route tests
│   └── database/          # Database integration tests
├── e2e/                   # End-to-end tests
│   ├── auth/              # Authentication flows
│   ├── projects/          # Project management
│   └── chat/              # Chat functionality
├── fixtures/              # Test data and fixtures
├── mocks/                 # Mock implementations
└── utils/                 # Testing utilities
```

## 📋 Available Test Suites

### 1. Multi-Project Analytics Testing
**Script:** `scripts/test-multi-project-analytics.ts`
**Command:** `./scripts/run-tests.sh multi-project`

Tests analytics functionality across multiple GitHub repositories to ensure the system can handle various project types and scales.

**Features:**
- Creates test projects from popular repositories (React, TypeScript, Next.js)
- Tests analytics API endpoints for each project
- Validates contributor data retrieval
- Tests configuration endpoints with RBAC
- Performs concurrent access testing
- Checks data integrity and consistency

### 2. Deployment Verification
**Script:** `scripts/deployment-verification.js`
**Commands:**
- `./scripts/run-tests.sh verify-local`
- `./scripts/run-tests.sh verify-staging` 
- `./scripts/run-tests.sh verify-prod`

Validates that the CodeMind application is properly deployed and functioning in different environments.

**Features:**
- Tests critical endpoints (home page, health check, APIs)
- Validates database connectivity
- Checks SSL certificate (for HTTPS deployments)
- Measures performance benchmarks
- Tests application configuration

### 3. GitHub Integration Testing
**Script:** `scripts/test-github-integration.ts`
**Command:** `./scripts/run-tests.sh github-integration`

Comprehensive testing of GitHub API integration and authentication.

### 4. Webhook Pipeline Validation
**Script:** `scripts/validate-webhook-pipeline.ts`
**Command:** `./scripts/run-tests.sh webhook-pipeline`

Validates webhook auto-fix functionality and log analysis patterns.

## 🔐 Security Features (RBAC)

### Role-Based Access Control
**Implementation:** `src/lib/rbac.ts`

The system now includes comprehensive RBAC for project configurations:

#### User Roles
- **Owner**: Full access to all project settings
- **Admin**: Can read/write configs and view secrets
- **Member**: Read-only access to configurations
- **Viewer**: Analytics access only

#### Permissions System
```typescript
// Example usage
const accessLevel = await getConfigAccessLevel(userId, projectId);
if (accessLevel.canViewSecrets) {
  // Show unmasked sensitive data
}
```

#### Field Masking
Sensitive fields are automatically masked based on user permissions:

```typescript
// API keys: sk-••••••••••••key123
// Private keys: -----BEGIN PRIVATE KEY-----\n••••••••••••••••••••\n-----END PRIVATE KEY-----
// Tokens: gho_••••••••token456
```

### Audit Logging
All configuration access is logged with:
- User ID and project ID
- Action performed (create, update, delete, view, test)
- Timestamp and IP address
- Fields accessed

## Running Tests

### Comprehensive Test Suite
```bash
# Run all tests (unit + integration + custom)
./scripts/run-tests.sh all-tests

# Run individual test suites
./scripts/run-tests.sh multi-project
./scripts/run-tests.sh verify-staging
./scripts/run-tests.sh github-integration
./scripts/run-tests.sh webhook-pipeline

# Show help and available commands
./scripts/run-tests.sh help
```

### Development Tests
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test auth.test.ts

# Run tests with coverage
pnpm test:coverage
```

### Integration Tests
```bash
# Run API integration tests
pnpm test:integration

# Run database tests
pnpm test:db
```

### E2E Tests
```bash
# Run all E2E tests
pnpm test:e2e

# Run E2E tests in headed mode
pnpm test:e2e:headed

# Run specific E2E test
pnpm test:e2e auth.spec.ts
```

## CI/CD Integration

Tests are automatically run in GitHub Actions:
- **Unit & Integration**: Run on every PR and push
- **E2E Tests**: Run on main branch and releases
- **Coverage Reports**: Uploaded to Codecov
- **Test Results**: Published as PR comments

## Test Environment

### Database Setup
- Uses separate test database
- Automatic migrations and seeding
- Cleanup after each test suite

### Environment Variables
- Test-specific configuration
- Mock external services
- Isolated test data

## 📊 Performance Benchmarks

### Response Time Thresholds
- **Home Page**: 3 seconds max
- **API Endpoints**: 2 seconds max  
- **Database Queries**: 1 second max

### Load Testing
The multi-project test suite includes concurrent access testing to validate system performance under load.

## 📁 Test Reports

All tests generate detailed reports saved to the `logs/` directory:

- `logs/multi-project-test-report.json` - Multi-project analytics test results
- `logs/deployment-verification-*.json` - Deployment verification results
- `logs/test-report-*.md` - Comprehensive test summary reports

## 🛠️ Configuration

### Environment Variables
```env
# For deployment verification
STAGING_URL=https://codemind-staging.vercel.app
PRODUCTION_URL=https://codemind.vercel.app

# For GitHub integration testing
GITHUB_TOKEN=your_github_token
GITHUB_APP_ID=your_app_id
```

### Database Setup
Tests require a working PostgreSQL database with the complete Prisma schema.

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure `DATABASE_URL` is properly configured
   - Run `npx prisma generate` to update the client

2. **GitHub API Rate Limits**
   - Configure `GITHUB_TOKEN` for higher rate limits
   - Tests include automatic retry logic

3. **Timeout Errors**
   - Adjust timeout values in test configurations
   - Check network connectivity for external API calls

### Debug Mode
Enable verbose logging by setting:
```bash
export DEBUG=codemind:*
```

## 📝 Adding New Tests

### Creating a New Test Suite

1. Create test file in `scripts/` directory
2. Add command to `scripts/run-tests.sh`
3. Update this README with documentation
4. Add CI/CD integration if needed

### Test Structure Template
```typescript
class MyTestSuite {
  private results: TestResult[] = [];

  private async logResult(name: string, success: boolean, message: string, data?: any) {
    // Standard logging format
  }

  async runTests() {
    // Implementation
  }
}
```

## Writing Tests

Follow the testing patterns and examples in each test directory. All new features should include appropriate test coverage.

## 🎯 Future Enhancements

- Integration with monitoring systems (Datadog, New Relic)
- Automated performance regression testing
- Visual diff testing for UI components
- End-to-end browser testing with Playwright
- Security vulnerability scanning
- API contract testing

---

**Last Updated:** October 14, 2025
**Version:** 2.0.0 - Complete Testing Infrastructure