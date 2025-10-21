# Testing Automation - Phase 1: Coverage Analysis Engine

## Overview

The Coverage Analysis Engine provides comprehensive test coverage analysis for JavaScript/TypeScript projects. It identifies untested files and functions, calculates complexity metrics, and generates actionable recommendations for test generation.

## Architecture

### Core Components

1. **CoverageAnalyzer** (`src/lib/testing/coverage-analyzer.ts`)
   - AST-based code parsing using Babel
   - Function extraction and complexity analysis
   - Test file detection and mapping
   - Priority-based recommendations

2. **TestAutomationService** (`src/lib/testing/test-automation-service.ts`)
   - Session management
   - Recommendation generation
   - Report formatting
   - Integration layer

3. **API Endpoint** (`src/app/api/testing/coverage/route.ts`)
   - RESTful coverage analysis API
   - Query parameter support
   - Export functionality

4. **CLI Tool** (`scripts/analyze-coverage.mjs`)
   - Command-line interface
   - Multiple output formats
   - Filtering options

## Features

### ✅ Implemented

- **AST-Based Analysis**: Parses JavaScript/TypeScript files using Babel parser
- **Function Detection**: Identifies functions, arrow functions, methods, and classes
- **Complexity Calculation**: Computes cyclomatic complexity for each function
- **Test File Mapping**: Automatically detects corresponding test files
- **Priority System**: Ranks files by testing priority (high/medium/low)
- **Coverage Metrics**: Provides detailed coverage percentages and gaps
- **Markdown Reports**: Generates comprehensive markdown reports
- **API Integration**: RESTful API for programmatic access
- **CLI Tool**: Command-line interface for manual analysis

### 📊 Metrics Tracked

- Total files vs tested files
- Total functions vs tested functions
- Overall coverage percentage
- Per-file coverage information
- Function-level untested code
- Cyclomatic complexity per function
- Lines of code per file

### 🎯 Priority Determination

**High Priority:**
- API routes with 3+ exported functions
- Service/library files with significant exports
- Functions with complexity > 5
- Core business logic

**Medium Priority:**
- React components
- Custom hooks
- Files with 2+ functions
- Utility functions

**Low Priority:**
- Already tested files
- Simple helper functions
- Configuration files

## Usage

### Via API

```typescript
// GET /api/testing/coverage?projectId=<id>
const response = await fetch('/api/testing/coverage?projectId=my-project');
const data = await response.json();

console.log('Coverage:', data.stats.overallCoverage);
console.log('High Priority Files:', data.recommendations.length);
```

### Via CLI

```bash
# Analyze entire project
node scripts/analyze-coverage.mjs

# Analyze specific directory
node scripts/analyze-coverage.mjs --path src/lib

# Export markdown report
node scripts/analyze-coverage.mjs --export

# Show only high priority files
node scripts/analyze-coverage.mjs --high-priority

# JSON output
node scripts/analyze-coverage.mjs --json
```

### Programmatic Usage

```typescript
import { TestAutomationService } from '@/lib/testing/test-automation-service';

const service = new TestAutomationService(process.cwd());

// Start analysis session
const session = await service.startSession('project-id');

// Get high priority recommendations
const highPriority = service.getHighPriorityRecommendations(session.id);

// Generate summary
const summary = service.generateSummary(session.id);

// Export report
await service.exportReport(session.id, './coverage-report.md');
```

## API Reference

### CoverageAnalyzer

```typescript
class CoverageAnalyzer {
  constructor(projectRoot: string);
  
  // Analyze entire project or specific directory
  async analyze(targetDir?: string): Promise<CoverageReport>;
  
  // Generate markdown report
  generateMarkdownReport(report: CoverageReport): string;
}
```

### TestAutomationService

```typescript
class TestAutomationService {
  constructor(projectRoot: string);
  
  // Start new analysis session
  async startSession(projectId: string, targetDir?: string): Promise<TestAutomationSession>;
  
  // Get session by ID
  getSession(sessionId: string): TestAutomationSession | undefined;
  
  // Get high priority recommendations
  getHighPriorityRecommendations(sessionId: string): TestRecommendation[];
  
  // Generate summary report
  generateSummary(sessionId: string): string;
  
  // Export report to file
  async exportReport(sessionId: string, outputPath: string): Promise<void>;
  
  // Analyze specific path
  async analyzePath(targetPath: string): Promise<FileCoverage[]>;
  
  // Analyze specific file
  async analyzeFile(filePath: string): Promise<FileCoverage | null>;
}
```

## Data Models

### CoverageReport

```typescript
interface CoverageReport {
  totalFiles: number;
  testedFiles: number;
  untestedFiles: number;
  totalFunctions: number;
  testedFunctions: number;
  untestedFunctions: number;
  overallCoverage: number;
  files: FileCoverage[];
  highPriorityFiles: FileCoverage[];
  timestamp: Date;
}
```

### FileCoverage

```typescript
interface FileCoverage {
  filePath: string;
  relativePath: string;
  hasTests: boolean;
  testFilePath?: string;
  functions: CodeFunction[];
  untestedFunctions: CodeFunction[];
  coveragePercentage: number;
  linesOfCode: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}
```

### CodeFunction

```typescript
interface CodeFunction {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  params: string[];
  isAsync: boolean;
  isExported: boolean;
  complexity: number;
  type: 'function' | 'method' | 'arrow' | 'class';
}
```

### TestRecommendation

```typescript
interface TestRecommendation {
  file: FileCoverage;
  priority: 'high' | 'medium' | 'low';
  estimatedTestCount: number;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  framework: 'jest' | 'vitest' | 'playwright';
  testType: 'unit' | 'integration' | 'e2e';
  reason: string;
}
```

## Example Output

### Console Output

```
🔍 Starting coverage analysis...

📊 Coverage Analysis Results

═══════════════════════════════════════════════════════════
Total Files:          127
Tested Files:         89 (70.1%)
Untested Files:       38
Total Functions:      543
Tested Functions:     412
Untested Functions:   131
Overall Coverage:     75.9%
═══════════════════════════════════════════════════════════

🚨 High Priority Files (8)

1. src/app/api/projects/route.ts
   Functions: 5 | Tests needed: 12
   Complexity: moderate | Framework: jest
   Reason: API route with 5 exported functions

2. src/lib/services/analytics.ts
   Functions: 7 | Tests needed: 15
   Complexity: complex | Framework: jest
   Reason: Core logic with 7 exported functions

...
```

### Markdown Report

```markdown
# Test Coverage Analysis Report

**Generated:** 2025-01-21T10:30:00.000Z

## Summary

| Metric | Value |
|--------|-------|
| Total Files | 127 |
| Tested Files | 89 (70.1%) |
| Untested Files | 38 (29.9%) |
| Total Functions | 543 |
| Tested Functions | 412 |
| Untested Functions | 131 |
| Overall Coverage | 75.9% |

## High Priority Files (Needs Testing)

| File | Functions | Reason |
|------|-----------|--------|
| `src/app/api/projects/route.ts` | 5 | API route with 5 exported functions |
| `src/lib/services/analytics.ts` | 7 | Core logic with 7 exported functions |
...
```

## Integration with Command Console

The Coverage Analysis Engine integrates with the existing `/test` command:

```
/test --coverage-analysis
```

This will:
1. Run coverage analysis
2. Display high priority files
3. Offer to generate tests for selected files

## Performance Considerations

- **Caching**: Analysis results are cached in sessions (1-hour TTL)
- **Incremental Analysis**: Can analyze specific directories
- **Async Processing**: File system operations are fully async
- **Memory Efficient**: Streams large file lists

## Next Steps (Phase 2)

With Phase 1 complete, we can now:

1. ✅ Identify which files need tests
2. ✅ Calculate function complexity
3. ✅ Prioritize test generation efforts

**Phase 2** will use this data to:
- Generate actual test cases using AI
- Create test file scaffolding
- Support multiple testing frameworks
- Auto-generate mocks and fixtures

## Testing

Run tests with:

```bash
npm test src/lib/testing/__tests__/coverage-analyzer.test.ts
```

## Dependencies

- `@babel/parser` - Parse JavaScript/TypeScript AST
- `@babel/traverse` - Traverse AST nodes
- `@babel/types` - Type definitions for AST

## Files Created

```
src/lib/testing/
├── coverage-analyzer.ts         (550 lines)
├── test-automation-service.ts   (280 lines)
└── __tests__/
    └── coverage-analyzer.test.ts (290 lines)

src/app/api/testing/coverage/
└── route.ts                      (140 lines)

scripts/
└── analyze-coverage.mjs          (120 lines)
```

**Total Lines of Code: ~1,380 lines**

## Status

✅ **Phase 1 Complete** - Coverage Analysis Engine is production-ready!

---

*Last Updated: January 21, 2025*
*Part of CodeMind Testing Automation Feature*
