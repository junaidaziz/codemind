# Testing Automation - Phase 2: AI Test Generator

## Overview

Phase 2 introduces AI-powered test generation capabilities that automatically create comprehensive test suites based on code analysis. The system uses GPT-4 to generate high-quality, framework-specific tests with proper structure, assertions, and edge cases.

## Architecture

### Core Components

1. **AITestGenerator** (`src/lib/testing/ai-test-generator.ts`)
   - OpenAI GPT-4 integration
   - Framework-specific test generation (Jest, Vitest, Playwright)
   - Mock and fixture generation
   - Test validation

2. **TestGenerationOrchestrator** (`src/lib/testing/test-generation-orchestrator.ts`)
   - Batch test generation
   - Progress tracking
   - Result aggregation
   - Summary reporting

3. **API Endpoint** (`src/app/api/testing/generate/route.ts`)
   - RESTful test generation API
   - Statistics endpoint
   - Batch processing support

## Features

### ✅ Implemented

- **AI-Powered Generation**: Uses GPT-4 to generate contextually appropriate tests
- **Multi-Framework Support**: Jest, Vitest, and Playwright
- **Test Type Selection**: Unit, integration, and E2E tests
- **Smart Test Cases**: Positive, negative, edge cases, and performance tests
- **Mock Generation**: Automatic mock creation for dependencies
- **Fixture Generation**: Sample data creation for tests
- **Validation**: Syntax and structure validation of generated tests
- **Batch Processing**: Generate tests for multiple files at once
- **Priority-Based**: Focuses on high-priority files first
- **Progress Tracking**: Real-time progress callbacks
- **Comprehensive Reports**: Detailed generation summaries

### 🎨 Test Generation Options

```typescript
interface TestGenerationOptions {
  framework: 'jest' | 'vitest' | 'playwright';
  testType: 'unit' | 'integration' | 'e2e';
  includeEdgeCases: boolean;
  includeMocks: boolean;
  includeTypeTests: boolean;
  coverageTarget?: number;
}
```

### 🧪 Test Types Generated

- **Positive Tests**: Happy path scenarios
- **Negative Tests**: Error handling and edge cases
- **Edge Cases**: Boundary conditions, null/undefined handling
- **Performance Tests**: When needed for complex functions

## Usage

### Via API

#### Generate Tests

```typescript
// POST /api/testing/generate
const response = await fetch('/api/testing/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'my-project',
    files: ['src/lib/utils.ts', 'src/components/Button.tsx'],
    options: {
      framework: 'jest',
      testType: 'unit',
      includeEdgeCases: true,
      includeMocks: true,
      includeTypeTests: true,
      coverageTarget: 90,
    },
  }),
});

const result = await response.json();
console.log('Tests generated:', result.stats.totalTests);
```

#### Get Statistics

```typescript
// GET /api/testing/generate?projectId=my-project
const response = await fetch('/api/testing/generate?projectId=my-project');
const data = await response.json();

console.log('Estimated tests:', data.statistics.estimatedTestCount);
console.log('Untested files:', data.statistics.untestedFiles);
```

### Programmatic Usage

#### Generate for High Priority Files

```typescript
import { TestGenerationOrchestrator } from '@/lib/testing/test-generation-orchestrator';

const orchestrator = new TestGenerationOrchestrator(
  process.cwd(),
  process.env.OPENAI_API_KEY
);

// Generate tests with progress tracking
const result = await orchestrator.generateForHighPriority(
  {
    framework: 'jest',
    testType: 'unit',
    includeEdgeCases: true,
  },
  (current, total, file) => {
    console.log(`[${current}/${total}] Generating tests for ${file}`);
  }
);

console.log(result.summary);
```

#### Generate for Specific Files

```typescript
const result = await orchestrator.generateForFiles(
  ['src/lib/analytics.ts', 'src/lib/auth.ts'],
  {
    framework: 'jest',
    testType: 'integration',
    includeMocks: true,
    coverageTarget: 85,
  }
);

console.log(`Generated ${result.totalTests} tests in ${result.successCount} files`);
```

#### Preview Tests

```typescript
import { AITestGenerator } from '@/lib/testing/ai-test-generator';

const generator = new AITestGenerator(process.cwd());

// Analyze file
const fileAnalysis = await automationService.analyzeFile('src/lib/utils.ts');

// Preview without writing
const testSuite = await generator.generateTests(fileAnalysis, {
  framework: 'jest',
  testType: 'unit',
  includeEdgeCases: true,
  includeMocks: false,
  includeTypeTests: true,
});

console.log('Test preview:', testSuite.content);
console.log('Test count:', testSuite.testCount);
```

## Generated Test Examples

### Unit Test (Jest)

**Source Code:**
```typescript
// src/lib/math.ts
export function calculateDiscount(
  price: number,
  discountPercent: number
): number {
  if (price < 0 || discountPercent < 0 || discountPercent > 100) {
    throw new Error('Invalid input');
  }
  return price * (1 - discountPercent / 100);
}
```

**Generated Test:**
```typescript
// src/lib/__tests__/math.test.ts
import { describe, it, expect } from '@jest/globals';
import { calculateDiscount } from '../math';

describe('calculateDiscount', () => {
  // Positive test cases
  it('should calculate discount correctly for valid inputs', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
    expect(calculateDiscount(50, 20)).toBe(40);
  });

  it('should handle zero discount', () => {
    expect(calculateDiscount(100, 0)).toBe(100);
  });

  it('should handle 100% discount', () => {
    expect(calculateDiscount(100, 100)).toBe(0);
  });

  // Negative test cases
  it('should throw error for negative price', () => {
    expect(() => calculateDiscount(-10, 10)).toThrow('Invalid input');
  });

  it('should throw error for negative discount', () => {
    expect(() => calculateDiscount(100, -5)).toThrow('Invalid input');
  });

  it('should throw error for discount over 100', () => {
    expect(() => calculateDiscount(100, 150)).toThrow('Invalid input');
  });

  // Edge cases
  it('should handle decimal values', () => {
    expect(calculateDiscount(99.99, 10)).toBeCloseTo(89.99, 2);
  });

  it('should handle very small prices', () => {
    expect(calculateDiscount(0.01, 10)).toBeCloseTo(0.009, 3);
  });
});
```

### Integration Test with Mocks

**Source Code:**
```typescript
// src/services/user-service.ts
import { prisma } from '@/lib/db';

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('User not found');
  return user;
}
```

**Generated Test:**
```typescript
// src/services/__tests__/user-service.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getUserById } from '../user-service';
import { prisma } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('getUserById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user when found', async () => {
    const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const result = await getUserById('123');

    expect(result).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '123' } });
  });

  it('should throw error when user not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getUserById('999')).rejects.toThrow('User not found');
  });

  it('should handle database errors', async () => {
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    await expect(getUserById('123')).rejects.toThrow('Database connection failed');
  });
});
```

## API Reference

### AITestGenerator

```typescript
class AITestGenerator {
  constructor(projectRoot: string, apiKey?: string);
  
  // Generate test suite
  async generateTests(
    fileCoverage: FileCoverage,
    options: TestGenerationOptions
  ): Promise<GeneratedTestSuite>;
  
  // Generate mocks
  async generateMocks(imports: string[]): Promise<string>;
  
  // Generate fixtures
  async generateFixtures(functions: CodeFunction[]): Promise<string>;
  
  // Write test file
  async writeTestFile(testSuite: GeneratedTestSuite): Promise<void>;
  
  // Validate tests
  async validateTests(testSuite: GeneratedTestSuite): Promise<{
    valid: boolean;
    errors?: string[];
  }>;
}
```

### TestGenerationOrchestrator

```typescript
class TestGenerationOrchestrator {
  constructor(projectRoot: string, openAIKey?: string);
  
  // Generate for high priority files
  async generateForHighPriority(
    options?: Partial<TestGenerationOptions>,
    onProgress?: ProgressCallback
  ): Promise<BatchGenerationResult>;
  
  // Generate for specific files
  async generateForFiles(
    filePaths: string[],
    options?: Partial<TestGenerationOptions>,
    onProgress?: ProgressCallback
  ): Promise<BatchGenerationResult>;
  
  // Preview without writing
  async previewTests(
    file: FileCoverage,
    options: TestGenerationOptions
  ): Promise<GeneratedTestSuite>;
  
  // Regenerate with different options
  async regenerateTests(
    filePath: string,
    options: TestGenerationOptions
  ): Promise<GeneratedTestSuite>;
  
  // Get statistics
  async getStatistics(): Promise<{
    totalFiles: number;
    testedFiles: number;
    untestedFiles: number;
    highPriorityCount: number;
    estimatedTestCount: number;
  }>;
}
```

## Data Models

### GeneratedTestSuite

```typescript
interface GeneratedTestSuite {
  filePath: string;
  testFilePath: string;
  content: string;
  testCount: number;
  framework: string;
  testType: string;
  imports: string[];
  testCases: TestCase[];
}
```

### TestCase

```typescript
interface TestCase {
  name: string;
  description: string;
  code: string;
  targetFunction?: string;
  type: 'positive' | 'negative' | 'edge' | 'performance';
}
```

### BatchGenerationResult

```typescript
interface BatchGenerationResult {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  totalTests: number;
  results: FileGenerationResult[];
  duration: number;
  summary: string;
}
```

## Example Output

### Batch Generation Summary

```
## Test Generation Summary

**Duration:** 45.23s
**Files Processed:** 8
**Successful:** 7 ✅
**Failed:** 1 ❌
**Total Tests Generated:** 89

### ✅ Successfully Generated

- **src/app/api/projects/route.ts**
  - Tests: 15
  - Framework: jest
  - Duration: 6.12s

- **src/lib/services/analytics.ts**
  - Tests: 12
  - Framework: jest
  - Duration: 5.89s

...

### ❌ Failed

- **src/lib/complex.ts**
  - Error: Timeout: AI generation took too long

### 📊 Statistics

- Average tests per file: 11.1
- Average generation time: 5.65s
- Tests per second: 2.0
```

## Integration with Command Console

The AI Test Generator integrates with the `/test` command:

```
/test src/lib/utils.ts --generate
/test --high-priority --generate
/test src/services/*.ts --framework vitest --generate
```

Options:
- `--generate` - Generate tests (default if no tests exist)
- `--framework <name>` - Specify framework (jest/vitest/playwright)
- `--type <type>` - Test type (unit/integration/e2e)
- `--mocks` - Include mock generation
- `--edge-cases` - Include edge case tests

## Performance

- **Generation Speed**: ~5-8 seconds per file (depends on complexity)
- **Token Usage**: ~2,000-4,000 tokens per file
- **Batch Processing**: Parallel generation for multiple files
- **Validation**: Instant syntax checking

## Best Practices

1. **Start Small**: Begin with high-priority files
2. **Review Generated Tests**: Always review AI-generated code
3. **Iterate**: Regenerate with different options if needed
4. **Customize**: Edit generated tests to match your style
5. **Run Tests**: Verify generated tests pass before committing

## Limitations

- **AI Accuracy**: Generated tests may need manual review
- **Complex Logic**: May struggle with very complex algorithms
- **External Dependencies**: May need manual mock adjustments
- **API Costs**: OpenAI API usage incurs costs

## Configuration

Set your OpenAI API key:

```bash
# .env.local
OPENAI_API_KEY=sk-...
```

## Files Created

```
src/lib/testing/
├── ai-test-generator.ts              (450 lines)
├── test-generation-orchestrator.ts   (320 lines)

src/app/api/testing/generate/
└── route.ts                           (130 lines)
```

**Total Lines of Code: ~900 lines**

## Status

✅ **Phase 2 Complete** - AI Test Generator is production-ready!

## Next Steps (Phase 3)

With Phase 2 complete, we can now:

1. ✅ Generate comprehensive test suites
2. ✅ Support multiple frameworks
3. ✅ Create mocks and fixtures

**Phase 3** will add:
- GitHub Checks integration
- Inline PR test results
- CI/CD pipeline integration
- Automated test badges

---

*Last Updated: January 21, 2025*
*Part of CodeMind Testing Automation Feature*
