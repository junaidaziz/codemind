/**
 * Coverage Analyzer Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CoverageAnalyzer } from '../coverage-analyzer';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('CoverageAnalyzer', () => {
  let tempDir: string;
  let analyzer: CoverageAnalyzer;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-test-'));
    analyzer = new CoverageAnalyzer(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('analyze()', () => {
    it('should analyze an empty project', async () => {
      const report = await analyzer.analyze();

      expect(report).toMatchObject({
        totalFiles: 0,
        testedFiles: 0,
        untestedFiles: 0,
        totalFunctions: 0,
        testedFunctions: 0,
        untestedFunctions: 0,
        overallCoverage: 0,
      });
    });

    it('should identify untested files', async () => {
      // Create a source file without tests
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      const sourceFile = path.join(tempDir, 'src', 'utils.ts');
      await fs.writeFile(
        sourceFile,
        `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`
      );

      const report = await analyzer.analyze();

      expect(report.totalFiles).toBe(1);
      expect(report.untestedFiles).toBe(1);
      expect(report.files[0].functions.length).toBeGreaterThan(0);
      expect(report.files[0].hasTests).toBe(false);
    });

    it('should identify tested files', async () => {
      // Create a source file
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      const sourceFile = path.join(tempDir, 'src', 'math.ts');
      await fs.writeFile(
        sourceFile,
        `export function subtract(a: number, b: number): number {
  return a - b;
}
`
      );

      // Create a test file
      await fs.mkdir(path.join(tempDir, 'src', '__tests__'), { recursive: true });
      const testFile = path.join(tempDir, 'src', '__tests__', 'math.test.ts');
      await fs.writeFile(
        testFile,
        `import { subtract } from '../math';

describe('math', () => {
  it('should subtract numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });
});
`
      );

      const report = await analyzer.analyze();

      expect(report.totalFiles).toBe(1);
      expect(report.testedFiles).toBe(1);
      expect(report.untestedFiles).toBe(0);
    });

    it('should calculate function complexity', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      const complexFile = path.join(tempDir, 'src', 'complex.ts');
      await fs.writeFile(
        complexFile,
        `export function complexFunction(x: number): string {
  if (x < 0) {
    return 'negative';
  } else if (x === 0) {
    return 'zero';
  } else if (x < 10) {
    return 'small';
  } else if (x < 100) {
    return 'medium';
  } else {
    return 'large';
  }
}
`
      );

      const report = await analyzer.analyze();

      expect(report.files[0].functions.length).toBe(1);
      expect(report.files[0].functions[0].complexity).toBeGreaterThan(1);
    });

    it('should identify high priority files', async () => {
      // Create an API route (high priority)
      await fs.mkdir(path.join(tempDir, 'src', 'api'), { recursive: true });
      const apiFile = path.join(tempDir, 'src', 'api', 'users.ts');
      await fs.writeFile(
        apiFile,
        `export async function getUsers() {
  return [];
}

export async function createUser(data: any) {
  return { id: 1, ...data };
}

export async function deleteUser(id: number) {
  return true;
}
`
      );

      const report = await analyzer.analyze();

      expect(report.files[0].priority).toBe('high');
      expect(report.files[0].reason).toContain('API route');
    });
  });

  describe('generateMarkdownReport()', () => {
    it('should generate a markdown report', async () => {
      // Create a simple project structure
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'helper.ts'),
        `export function helper() { return true; }`
      );

      const report = await analyzer.analyze();
      const markdown = analyzer.generateMarkdownReport(report);

      expect(markdown).toContain('# Test Coverage Analysis Report');
      expect(markdown).toContain('Summary');
      expect(markdown).toContain('Total Files');
      expect(markdown).toContain('Overall Coverage');
    });
  });

  describe('extractFunctions()', () => {
    it('should extract regular functions', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      const file = path.join(tempDir, 'src', 'functions.ts');
      await fs.writeFile(
        file,
        `function regularFunction() {
  return 'regular';
}

export function exportedFunction() {
  return 'exported';
}
`
      );

      const report = await analyzer.analyze();
      const functions = report.files[0].functions;

      expect(functions.length).toBeGreaterThanOrEqual(2);
      expect(functions.some(f => f.type === 'function')).toBe(true);
    });

    it('should extract arrow functions', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      const file = path.join(tempDir, 'src', 'arrows.ts');
      await fs.writeFile(
        file,
        `const arrowFunc = () => {
  return 'arrow';
};

export const exportedArrow = async (x: number) => {
  return x * 2;
};
`
      );

      const report = await analyzer.analyze();
      const functions = report.files[0].functions;

      expect(functions.length).toBeGreaterThanOrEqual(1);
      expect(functions.some(f => f.type === 'arrow')).toBe(true);
    });

    it('should extract class methods', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      const file = path.join(tempDir, 'src', 'class.ts');
      await fs.writeFile(
        file,
        `export class MyClass {
  method1() {
    return 1;
  }

  async method2() {
    return 2;
  }
}
`
      );

      const report = await analyzer.analyze();
      const functions = report.files[0].functions;

      expect(functions.length).toBeGreaterThanOrEqual(2);
      expect(functions.some(f => f.type === 'method')).toBe(true);
      expect(functions.some(f => f.type === 'class')).toBe(true);
    });
  });

  describe('determinePriority()', () => {
    it('should assign high priority to API routes', async () => {
      await fs.mkdir(path.join(tempDir, 'src', 'app', 'api', 'test'), { recursive: true });
      const file = path.join(tempDir, 'src', 'app', 'api', 'test', 'route.ts');
      await fs.writeFile(
        file,
        `export async function GET() {
  return Response.json({ success: true });
}

export async function POST() {
  return Response.json({ success: true });
}

export async function DELETE() {
  return Response.json({ success: true });
}
`
      );

      const report = await analyzer.analyze();

      expect(report.files[0].priority).toBe('high');
    });

    it('should assign medium priority to components', async () => {
      await fs.mkdir(path.join(tempDir, 'src', 'components'), { recursive: true });
      const file = path.join(tempDir, 'src', 'components', 'Button.tsx');
      await fs.writeFile(
        file,
        `export function Button() {
  return <button>Click me</button>;
}
`
      );

      const report = await analyzer.analyze();

      expect(report.files[0].priority).toBe('medium');
    });
  });
});
