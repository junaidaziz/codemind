# CodeMind Testing Configuration

## Testing Setup for CodeMind

This configuration sets up comprehensive testing for the CodeMind platform using modern testing tools and best practices.

## Testing Stack

- **Unit Testing**: Jest with @testing-library/react
- **Integration Testing**: Jest with API route testing
- **E2E Testing**: Playwright for full browser automation
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

## Running Tests

### Development
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

## Writing Tests

Follow the testing patterns and examples in each test directory. All new features should include appropriate test coverage.