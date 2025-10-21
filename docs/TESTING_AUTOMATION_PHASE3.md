# Testing Automation - Phase 3: GitHub Checks Integration

> **Status**: ✅ Complete  
> **Phase**: 3 of 5  
> **LOC**: ~750 lines

## Overview

Phase 3 integrates testing automation with GitHub's Checks API to provide inline test results, coverage reports, and status badges directly in pull requests. This phase also includes full CI/CD pipeline integration for GitHub Actions, GitLab CI, CircleCI, and Jenkins.

## Architecture

```
┌─────────────────────────────────────────────────┐
│          GitHub Checks Integration              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │      GitHubChecksService                  │ │
│  ├───────────────────────────────────────────┤ │
│  │ - Create check runs                       │ │
│  │ - Update check status                     │ │
│  │ - Add PR comments                         │ │
│  │ - Generate status badges                  │ │
│  │ - Create inline annotations               │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │      CIIntegrationService                 │ │
│  ├───────────────────────────────────────────┤ │
│  │ - Detect CI environment                   │ │
│  │ - Run test pipeline                       │ │
│  │ - Parse test results                      │ │
│  │ - Generate workflow configs               │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Features

### 1. GitHub Checks API Integration

- **Check Runs**: Create and update GitHub check runs for test execution, test generation, and coverage
- **Inline Annotations**: Display test failures and coverage issues directly in code
- **Status Badges**: Auto-generate test status and coverage badges
- **PR Comments**: Post formatted test results and coverage reports as PR comments

### 2. CI/CD Pipeline Integration

- **Multi-Platform Support**: GitHub Actions, GitLab CI, CircleCI, Jenkins
- **Environment Detection**: Auto-detect CI environment and extract metadata
- **Test Execution**: Run tests and parse results in CI environment
- **Coverage Analysis**: Analyze and report coverage in CI pipeline
- **Failure Handling**: Configurable failure thresholds and exit codes

### 3. Test Result Display

- **Test Execution Checks**: Display passed/failed/skipped test counts
- **Coverage Reports**: Show line, function, branch, and statement coverage
- **Test Generation Checks**: Report AI-generated test statistics
- **Failure Details**: Detailed stack traces and error messages

## Installation

The GitHub Checks integration requires the Octokit library:

```bash
pnpm add @octokit/rest
```

## Usage

### API Usage

#### Create Test Execution Check

```typescript
import { GitHubChecksService } from '@/lib/testing/github-checks-service';

const checksService = new GitHubChecksService(
  process.env.GITHUB_TOKEN!,
  'owner',
  'repo'
);

const testResult: TestExecutionResult = {
  success: true,
  totalTests: 150,
  passedTests: 148,
  failedTests: 2,
  skippedTests: 0,
  duration: 25000,
  failures: [
    {
      testName: 'should validate user input',
      filePath: 'src/lib/validators.ts',
      line: 42,
      message: 'Expected true but got false',
      type: 'failure',
    },
  ],
  coverage: {
    lines: { total: 1000, covered: 850, percentage: 85 },
    functions: { total: 200, covered: 180, percentage: 90 },
    branches: { total: 300, covered: 240, percentage: 80 },
    statements: { total: 1200, covered: 1020, percentage: 85 },
  },
};

const checkRunId = await checksService.createTestExecutionCheck(
  'abc123', // commit SHA
  testResult
);
```

#### Create Coverage Check

```typescript
const coverage: CoverageData = {
  lines: { total: 1000, covered: 850, percentage: 85 },
  functions: { total: 200, covered: 180, percentage: 90 },
  branches: { total: 300, covered: 240, percentage: 80 },
  statements: { total: 1200, covered: 1020, percentage: 85 },
};

await checksService.createCoverageCheck('abc123', coverage);
```

#### Add Test Badge to PR

```typescript
await checksService.addTestBadgeToPR(123, testResult);
```

#### Comment on PR

```typescript
await checksService.commentTestResults(123, testResult);
```

### REST API Usage

#### POST /api/testing/checks

Create a new check run:

```bash
curl -X POST http://localhost:3000/api/testing/checks \
  -H "Content-Type: application/json" \
  -d '{
    "githubToken": "ghp_xxxxx",
    "owner": "username",
    "repo": "repository",
    "headSha": "abc123",
    "type": "test-execution",
    "result": {
      "success": true,
      "totalTests": 150,
      "passedTests": 148,
      "failedTests": 2,
      "skippedTests": 0,
      "duration": 25000,
      "failures": []
    }
  }'
```

#### PUT /api/testing/checks

Update existing check run:

```bash
curl -X PUT http://localhost:3000/api/testing/checks \
  -H "Content-Type: application/json" \
  -d '{
    "githubToken": "ghp_xxxxx",
    "owner": "username",
    "repo": "repository",
    "checkRunId": 12345,
    "status": "completed",
    "conclusion": "success"
  }'
```

#### GET /api/testing/checks

List check runs for a ref:

```bash
curl "http://localhost:3000/api/testing/checks?githubToken=ghp_xxxxx&owner=username&repo=repository&ref=main"
```

### CI/CD Integration

#### GitHub Actions

Create `.github/workflows/testing.yml`:

```yaml
name: Testing Automation

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run CI Integration
        run: node scripts/ci-integration.mjs --run-tests --generate-tests --analyze-coverage --update-checks --fail-on-error
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

#### CLI Usage

```bash
# Run full pipeline
node scripts/ci-integration.mjs --run-tests --generate-tests --analyze-coverage

# Run with GitHub checks integration
node scripts/ci-integration.mjs --run-tests --update-checks --comment-pr

# Run with failure on low coverage
node scripts/ci-integration.mjs --run-tests --analyze-coverage --fail-on-error --coverage-threshold 80

# Generate tests only
node scripts/ci-integration.mjs --generate-tests
```

### Programmatic Usage

```typescript
import { CIIntegrationService } from '@/lib/testing/ci-integration-service';

const service = new CIIntegrationService({
  githubToken: process.env.GITHUB_TOKEN,
  owner: 'username',
  repo: 'repository',
  runTests: true,
  generateTests: true,
  analyzeCoverage: true,
  updateChecks: true,
  commentOnPR: true,
  failOnTestFailure: true,
  failOnLowCoverage: true,
  coverageThreshold: 80,
});

// Detect CI environment
const env = service.detectEnvironment();
console.log(`Running in ${env.name} on branch ${env.branch}`);

// Run full pipeline
const results = await service.runPipeline();

if (results.success) {
  console.log('✅ Pipeline succeeded');
} else {
  console.log('❌ Pipeline failed');
}
```

## API Reference

### GitHubChecksService

#### Constructor

```typescript
new GitHubChecksService(
  githubToken: string,
  owner: string,
  repo: string
)
```

#### Methods

- `createTestExecutionCheck(headSha: string, result: TestExecutionResult): Promise<number>`
- `createTestGenerationCheck(headSha: string, result: BatchGenerationResult): Promise<number>`
- `createCoverageCheck(headSha: string, coverage: CoverageData): Promise<number>`
- `updateCheckRun(checkRunId: number, status: CheckStatus, conclusion?: CheckConclusion, output?: Output): Promise<void>`
- `addTestBadgeToPR(prNumber: number, result: TestExecutionResult): Promise<void>`
- `commentTestResults(prNumber: number, result: TestExecutionResult): Promise<void>`
- `listCheckRuns(ref: string): Promise<CheckRun[]>`

### CIIntegrationService

#### Constructor

```typescript
new CIIntegrationService(options?: CIIntegrationOptions)
```

#### Methods

- `detectEnvironment(): CIEnvironment`
- `runPipeline(): Promise<PipelineResult>`
- `static generateGitHubWorkflow(options?: WorkflowOptions): string`
- `static generateGitLabCI(options?: CIOptions): string`

## Data Models

### TestExecutionResult

```typescript
interface TestExecutionResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  failures: TestFailure[];
  coverage?: CoverageData;
}
```

### TestFailure

```typescript
interface TestFailure {
  testName: string;
  filePath: string;
  line?: number;
  message: string;
  stack?: string;
  type: 'error' | 'failure' | 'timeout';
}
```

### CoverageData

```typescript
interface CoverageData {
  lines: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
}
```

### CIEnvironment

```typescript
interface CIEnvironment {
  name: 'github' | 'gitlab' | 'circle' | 'jenkins' | 'unknown';
  isCI: boolean;
  branch?: string;
  commit?: string;
  prNumber?: number;
  buildId?: string;
}
```

## Examples

### Example 1: GitHub Check Run Output

When a test execution check is created, GitHub displays:

```
✅ All 150 tests passed

Test Results

✅ 148/150 tests passed

Breakdown:
- ✅ Passed: 148
- ❌ Failed: 2
- ⏭️ Skipped: 0
- ⏱️ Duration: 25.00s

Coverage:
- Lines: 85.0%
- Functions: 90.0%
- Branches: 80.0%
```

### Example 2: PR Comment

```markdown
## ✅ Test Results

**Status:** All tests passed!

| Metric | Value |
|--------|-------|
| Total Tests | 150 |
| Passed | 148 ✅ |
| Failed | 2 ❌ |
| Skipped | 0 ⏭️ |
| Duration | 25.00s |

### 📊 Coverage

| Type | Coverage |
|------|----------|
| Lines | 85.0% |
| Functions | 90.0% |
| Branches | 80.0% |

---
*Generated by CodeMind Testing Automation* 🤖
```

### Example 3: Inline Annotations

GitHub displays inline annotations in the Files Changed view:

```
src/lib/validators.ts:42
❌ should validate user input
Expected true but got false
```

## CI/CD Platform Support

### GitHub Actions

- Full native support via GITHUB_* environment variables
- Automatic PR number detection
- Native check runs integration

### GitLab CI

- Support via CI_* environment variables
- Merge request detection
- Coverage report generation

### CircleCI

- Support via CIRCLECI and CIRCLE_* variables
- PR number from CIRCLE_PR_NUMBER
- Build tracking via CIRCLE_BUILD_NUM

### Jenkins

- Support via JENKINS_HOME and GIT_* variables
- Git branch and commit detection
- Build tracking via BUILD_ID

## Environment Variables

### Required for GitHub Integration

- `GITHUB_TOKEN`: GitHub personal access token with `checks:write` permission
- `GITHUB_REPOSITORY`: Repository in format `owner/repo`
- `GITHUB_SHA`: Commit SHA to attach checks to

### Optional

- `OPENAI_API_KEY`: Required if using test generation
- `COVERAGE_THRESHOLD`: Minimum coverage percentage (default: 80)

## Best Practices

1. **Token Permissions**: Ensure GitHub token has `checks:write` and `pull_requests:write` permissions
2. **Rate Limiting**: Be aware of GitHub API rate limits (5000 requests/hour)
3. **Annotation Limits**: GitHub limits check runs to 50 annotations
4. **PR Comments**: Consider rate limiting for PR comments in busy repositories
5. **Error Handling**: Always handle API errors gracefully
6. **Token Security**: Never commit tokens to repository; use CI secrets

## Limitations

1. **GitHub Only**: Check runs are GitHub-specific; other platforms use different mechanisms
2. **Annotation Limit**: Maximum 50 annotations per check run
3. **API Rate Limits**: Subject to GitHub API rate limiting
4. **Token Requirements**: Requires token with write permissions
5. **Public Repos**: Works best with public repos; private repos may need additional setup

## Troubleshooting

### "Resource not accessible by integration"

- Ensure GitHub token has correct permissions
- Verify repository access
- Check if token is for correct account

### "Check run not appearing"

- Verify commit SHA is correct
- Ensure head SHA matches the PR commit
- Check GitHub Actions permissions

### "PR comment not posting"

- Verify `pull_requests:write` permission
- Ensure PR number is correct
- Check if PR is from fork (may require special handling)

### "Coverage data not displaying"

- Verify coverage data format matches `CoverageData` interface
- Ensure test framework is generating coverage correctly
- Check Jest/Vitest configuration

## Next Steps

After Phase 3, continue to:

- **Phase 4**: Snapshot Management - Auto-detect and manage test snapshots
- **Phase 5**: Failure Analysis - AI-powered test debugging and automatic retry

## Related Documentation

- [Phase 1: Coverage Analysis Engine](./TESTING_AUTOMATION_PHASE1.md)
- [Phase 2: AI Test Generator](./TESTING_AUTOMATION_PHASE2.md)
- [GitHub Checks API Documentation](https://docs.github.com/en/rest/checks)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
