# Testing Automation - Phase 5: Failure Analysis

## Overview

Phase 5 implements intelligent test failure analysis powered by AI. This feature helps developers quickly understand why tests fail, identify root causes, and get actionable suggestions for fixing issues.

## Features

### 1. AI-Powered Failure Analysis
- **Root Cause Identification**: Uses GPT-4 to analyze test failures and identify underlying issues
- **Confidence Scoring**: Provides confidence levels (0.0-1.0) for each analysis
- **Category Classification**: Categorizes failures into 6 distinct types
- **Suggested Fixes**: Offers prioritized, effort-estimated fix recommendations

### 2. Failure Categories

The analyzer classifies failures into these categories:

| Category | Description | Common Causes |
|----------|-------------|---------------|
| `logic-error` | Business logic or algorithm issues | Wrong calculations, incorrect conditionals, flawed algorithms |
| `async-issue` | Problems with asynchronous code | Unhandled promises, race conditions, timing issues |
| `dependency-issue` | External dependency problems | API failures, missing mocks, version conflicts |
| `environment` | Environment-specific issues | Missing env vars, file system access, permissions |
| `flaky` | Intermittent, non-deterministic failures | Random data, timing dependencies, shared state |
| `data-issue` | Data-related problems | Invalid fixtures, type mismatches, boundary conditions |

### 3. Automatic Retry Mechanism
- **Configurable Attempts**: Set maximum retry attempts (default: 3)
- **Backoff Strategies**: Choose between linear or exponential backoff
- **Smart Detection**: Identifies flaky tests vs. consistent failures

### 4. Pattern Detection
- **Common Patterns**: Identifies recurring failure patterns across multiple tests
- **Batch Analysis**: Processes multiple failures together to find correlations
- **Summary Reports**: Generates markdown reports with insights

### 5. Suggested Fixes

Each fix recommendation includes:
- **Description**: Clear explanation of the fix
- **Priority**: High, medium, or low urgency
- **Effort**: Estimated effort (trivial, easy, moderate, complex)
- **Implementation**: Specific code changes or actions

## Architecture

### Core Components

```
src/lib/testing/
├── failure-analyzer.ts       # Core analyzer with AI integration
└── ...

src/app/api/testing/
├── failures/
│   └── route.ts               # REST API endpoint
└── ...

scripts/
├── failure-analyzer.mjs       # CLI tool
└── ...
```

### Data Flow

```
Test Execution
    ↓
Failure Detection
    ↓
FailureAnalyzer.analyzeFailure()
    ↓
GPT-4 Analysis (or fallback)
    ↓
Category + Root Cause + Fixes
    ↓
Report Generation
```

## Usage

### CLI Usage

#### Analyze All Test Failures

```bash
node scripts/failure-analyzer.mjs analyze
```

This will:
1. Run your test suite
2. Capture all failures
3. Analyze each failure with AI
4. Display categorized results with suggested fixes

#### Analyze Specific Test File

```bash
node scripts/failure-analyzer.mjs analyze --file src/components/Button.test.tsx
```

#### Generate Detailed Report

```bash
node scripts/failure-analyzer.mjs report --output failure-report.md
```

#### Retry Failed Test

```bash
node scripts/failure-analyzer.mjs retry \
  --file src/api/users.test.ts \
  --test "should fetch user data" \
  --attempts 5 \
  --delay 2000 \
  --backoff exponential
```

Options:
- `--attempts`: Number of retry attempts (default: 3)
- `--delay`: Initial delay in ms (default: 1000)
- `--backoff`: Backoff strategy - `linear` or `exponential` (default: exponential)

### Programmatic Usage

```typescript
import { FailureAnalyzer } from '@/lib/testing/failure-analyzer';

const analyzer = new FailureAnalyzer();

// Analyze single failure
const result = await analyzer.analyzeFailure({
  testName: 'should calculate total',
  testFile: 'src/utils/math.test.ts',
  errorMessage: 'Expected 10 but got 9',
  stackTrace: '...',
  failureType: 'assertion',
});

console.log('Root Cause:', result.rootCause);
console.log('Category:', result.category);
console.log('Confidence:', result.confidence);
console.log('Suggested Fixes:', result.suggestedFixes);

// Generate report
const report = analyzer.generateReport(result);
console.log(report);
```

#### Batch Analysis

```typescript
const failures = [
  {
    testName: 'should fetch data',
    testFile: 'src/api.test.ts',
    errorMessage: 'Network request failed',
    stackTrace: '...',
    failureType: 'error',
  },
  {
    testName: 'should save data',
    testFile: 'src/api.test.ts',
    errorMessage: 'Connection timeout',
    stackTrace: '...',
    failureType: 'timeout',
  },
];

const result = await analyzer.analyzeBatch(failures);
console.log(result.summary);
console.log('Total failures:', result.totalFailures);
console.log('Unique categories:', result.uniqueCategories);
console.log('Common patterns:', result.commonPatterns);

// Generate batch report
const batchReport = analyzer.generateBatchReport(result);
```

#### Automatic Retry

```typescript
const retryConfig = {
  maxAttempts: 5,
  delayMs: 1000,
  backoff: 'exponential' as const,
};

const retryResult = await analyzer.retryTest(
  'src/flaky.test.ts',
  'intermittent test',
  retryConfig
);

if (retryResult.success) {
  console.log('Test passed after', retryResult.attempts, 'attempts');
} else {
  console.log('Test failed after all attempts');
  // Analyze the failures
  const analysis = await analyzer.analyzeBatch(retryResult.failures);
  console.log('Analysis:', analysis.summary);
}
```

### REST API Usage

#### Analyze Single Failure

```bash
curl -X POST http://localhost:3000/api/testing/failures \
  -H "Content-Type: application/json" \
  -d '{
    "action": "analyze",
    "failure": {
      "testName": "should validate email",
      "testFile": "src/utils/validation.test.ts",
      "errorMessage": "Expected true but got false",
      "stackTrace": "...",
      "failureType": "assertion"
    },
    "generateReport": true
  }'
```

Response:
```json
{
  "failure": { ... },
  "category": "logic-error",
  "rootCause": "Email validation regex doesn't handle plus signs in addresses",
  "confidence": 0.85,
  "suggestedFixes": [
    {
      "description": "Update regex to allow '+' in email local part",
      "priority": "high",
      "effort": "easy",
      "implementation": "Change regex from /^[a-z0-9._-]+@/ to /^[a-z0-9._+-]+@/"
    }
  ],
  "relatedPatterns": ["validation", "regex"],
  "estimatedFixTime": "15 minutes",
  "report": "# Test Failure Analysis\n\n..."
}
```

#### Batch Analysis

```bash
curl -X POST http://localhost:3000/api/testing/failures \
  -H "Content-Type: application/json" \
  -d '{
    "action": "batch",
    "failures": [
      { "testName": "test1", ... },
      { "testName": "test2", ... }
    ],
    "generateReport": true
  }'
```

#### Retry Test

```bash
curl -X POST http://localhost:3000/api/testing/failures \
  -H "Content-Type: application/json" \
  -d '{
    "action": "retry",
    "testFile": "src/api.test.ts",
    "testName": "should fetch data",
    "retryConfig": {
      "maxAttempts": 5,
      "delayMs": 2000,
      "backoff": "exponential"
    }
  }'
```

## Data Models

### FailureInfo

```typescript
interface FailureInfo {
  testName: string;           // Name of the failed test
  testFile: string;           // Path to test file
  errorMessage: string;       // Error message from test
  stackTrace: string;         // Full stack trace
  failureType: 'assertion' | 'timeout' | 'error' | 'unknown';
}
```

### AnalysisResult

```typescript
interface AnalysisResult {
  failure: FailureInfo;
  category: 'logic-error' | 'async-issue' | 'dependency-issue' | 
            'environment' | 'flaky' | 'data-issue';
  rootCause: string;          // Identified root cause
  confidence: number;         // 0.0 to 1.0
  suggestedFixes: SuggestedFix[];
  relatedPatterns: string[];  // Related keywords/patterns
  estimatedFixTime: string;   // Human-readable estimate
}
```

### SuggestedFix

```typescript
interface SuggestedFix {
  description: string;        // What to do
  priority: 'high' | 'medium' | 'low';
  effort: 'trivial' | 'easy' | 'moderate' | 'complex';
  implementation: string;     // Specific steps or code
}
```

### BatchAnalysisResult

```typescript
interface BatchAnalysisResult {
  analyses: AnalysisResult[];
  summary: string;            // Overall summary
  totalFailures: number;
  uniqueCategories: string[];
  commonPatterns: string[];
}
```

### RetryResult

```typescript
interface RetryResult {
  success: boolean;
  attempts: number;
  failures: FailureInfo[];    // All failures during retries
  finalResult?: TestResult;   // Last test result
}
```

## Configuration

### Environment Variables

```env
# OpenAI API Key (required for AI analysis)
OPENAI_API_KEY=your_api_key_here

# Optional: Model configuration
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.3
OPENAI_MAX_TOKENS=2000
```

### Fallback Analysis

When AI is unavailable, the analyzer provides basic pattern-based analysis:

```typescript
// Automatic fallback when OPENAI_API_KEY is not set
const result = await analyzer.analyzeFailure(failure);
// Returns pattern-based analysis without AI
```

## Best Practices

### 1. Regular Analysis

Run failure analysis as part of your development workflow:

```bash
# After test failures
npm test || node scripts/failure-analyzer.mjs analyze
```

### 2. Track Patterns

Monitor common patterns over time:

```bash
# Generate weekly reports
node scripts/failure-analyzer.mjs report --output weekly-report.md
```

### 3. Use Retry Strategically

Reserve retry for legitimately flaky tests:

```bash
# Good: Network-dependent tests
node scripts/failure-analyzer.mjs retry --file src/api.test.ts --test "should fetch"

# Bad: Logic errors (won't pass on retry)
# Don't retry assertion failures from logic bugs
```

### 4. Act on High-Priority Fixes

Focus on high-priority, low-effort fixes first:

```typescript
const result = await analyzer.analyzeBatch(failures);
const quickWins = result.analyses
  .flatMap(a => a.suggestedFixes)
  .filter(f => f.priority === 'high' && f.effort === 'easy')
  .sort((a, b) => a.priority.localeCompare(b.priority));
```

### 5. Document Recurring Issues

If the same category appears frequently:

```typescript
const categoryCount = {};
result.analyses.forEach(a => {
  categoryCount[a.category] = (categoryCount[a.category] || 0) + 1;
});

// If dependency-issue appears often, consider mocking strategy review
```

## Integration Examples

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test with Analysis

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm install
      - name: Run tests
        id: tests
        run: npm test || echo "TESTS_FAILED=true" >> $GITHUB_ENV
      - name: Analyze failures
        if: env.TESTS_FAILED == 'true'
        run: |
          node scripts/failure-analyzer.mjs analyze --output failure-report.md
      - name: Upload failure report
        if: env.TESTS_FAILED == 'true'
        uses: actions/upload-artifact@v3
        with:
          name: failure-analysis
          path: failure-report.md
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
npm test || {
  echo "Tests failed. Running analysis..."
  node scripts/failure-analyzer.mjs analyze
  exit 1
}
```

### Jest Reporter

Create a custom Jest reporter:

```javascript
// custom-reporter.js
class FailureAnalyzerReporter {
  onRunComplete(contexts, results) {
    if (results.numFailedTests > 0) {
      const { exec } = require('child_process');
      exec('node scripts/failure-analyzer.mjs analyze', (error, stdout) => {
        console.log(stdout);
      });
    }
  }
}

module.exports = FailureAnalyzerReporter;
```

```json
// jest.config.js
{
  "reporters": [
    "default",
    "<rootDir>/custom-reporter.js"
  ]
}
```

## Advanced Features

### Custom Categories

Extend the analyzer with custom categories:

```typescript
import { FailureAnalyzer } from '@/lib/testing/failure-analyzer';

class CustomAnalyzer extends FailureAnalyzer {
  protected async analyzeWithAI(failure: FailureInfo): Promise<AnalysisResult> {
    const result = await super.analyzeWithAI(failure);
    
    // Add custom logic
    if (failure.errorMessage.includes('database')) {
      result.category = 'database-issue';
      result.suggestedFixes.unshift({
        description: 'Check database connection',
        priority: 'high',
        effort: 'easy',
        implementation: 'Verify DATABASE_URL environment variable',
      });
    }
    
    return result;
  }
}
```

### Machine Learning Integration

Track analyses to improve over time:

```typescript
interface AnalysisHistory {
  failure: FailureInfo;
  analysis: AnalysisResult;
  actualFix: string;
  wasCorrect: boolean;
  timestamp: Date;
}

const history: AnalysisHistory[] = [];

// After fixing
history.push({
  failure,
  analysis: result,
  actualFix: 'Updated regex pattern',
  wasCorrect: result.suggestedFixes[0].description.includes('regex'),
  timestamp: new Date(),
});

// Use history to improve future analyses
```

## Troubleshooting

### Issue: No failures detected

**Cause**: Tests are passing or Jest isn't outputting JSON

**Solution**:
```bash
# Ensure JSON output
npm test -- --json --outputFile=test-results.json

# Or use the CLI directly
node scripts/failure-analyzer.mjs analyze --file test-results.json
```

### Issue: AI analysis timeout

**Cause**: GPT-4 API slow or unavailable

**Solution**:
```typescript
// Increase timeout or use fallback
const analyzer = new FailureAnalyzer({
  aiTimeout: 30000,  // 30 seconds
  useFallback: true,
});
```

### Issue: Inaccurate suggestions

**Cause**: Insufficient context in error messages

**Solution**:
```typescript
// Provide more context
const failure = {
  testName: 'should validate user',
  testFile: 'src/user.test.ts',
  errorMessage: 'Validation failed',
  stackTrace: fullStackTrace,
  failureType: 'assertion',
  // Add context
  testCode: `test('should validate user', () => { ... })`,
  sourceCode: `function validateUser(user) { ... }`,
};
```

### Issue: High API costs

**Cause**: Analyzing many failures frequently

**Solution**:
1. Use batch analysis instead of individual calls
2. Cache results for similar failures
3. Use fallback for simple patterns
4. Set up rate limiting

```typescript
// Cache similar failures
const cache = new Map();
const cacheKey = `${failure.testFile}:${failure.errorMessage.slice(0, 50)}`;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

## Performance

### Benchmarks

| Operation | Average Time | Notes |
|-----------|-------------|-------|
| Single failure analysis (with AI) | 2-4s | Depends on GPT-4 API |
| Single failure analysis (fallback) | <100ms | Pattern-based only |
| Batch analysis (10 failures) | 15-20s | Parallel processing |
| Test retry (3 attempts) | 5-15s | Depends on test duration |

### Optimization Tips

1. **Use batch analysis**: Process multiple failures together
2. **Cache results**: Store analyses for recurring failures
3. **Smart retry**: Only retry flaky tests, not logic errors
4. **Parallel processing**: Analyze failures concurrently
5. **Fallback first**: Use pattern-based analysis before AI

## Future Enhancements

- [ ] Visual failure dashboard
- [ ] Integration with error tracking services (Sentry, Rollbar)
- [ ] Historical trend analysis
- [ ] Auto-fix capabilities for common patterns
- [ ] Custom AI model training on project-specific failures
- [ ] Team collaboration features (shared insights)
- [ ] Slack/Discord notifications for critical failures

## Related Documentation

- [Phase 1: Coverage Analysis](./TESTING_AUTOMATION_PHASE1.md)
- [Phase 2: AI Test Generator](./TESTING_AUTOMATION_PHASE2.md)
- [Phase 3: GitHub Checks Integration](./TESTING_AUTOMATION_PHASE3.md)
- [Phase 4: Snapshot Management](./TESTING_AUTOMATION_PHASE4.md)
- [Main Testing Guide](./TESTING.md)

## Support

For issues or questions:
1. Check error messages in console output
2. Review the troubleshooting section above
3. Examine the generated reports for insights
4. Verify OpenAI API key is configured correctly
5. Check test output format is compatible (Jest JSON)
