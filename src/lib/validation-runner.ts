/**
 * Validation Runner (Phase scaffold)
 * Simulates lint, typecheck, and test execution.
 * Future: spawn real processes inside ephemeral workspace.
 */

export interface ValidationStepResult {
  step: string;
  success: boolean;
  durationMs: number;
  output: string;
}

export interface ValidationSummary {
  steps: ValidationStepResult[];
  allPassed: boolean;
}

export async function runValidationSimulation(changedFiles: string[]): Promise<ValidationSummary> {
  // If feature flag for real validation is enabled, delegate
  if (process.env.AUTOFIX_REAL_VALIDATION === 'true') {
    return runRealValidation(changedFiles);
  }
  const steps: ValidationStepResult[] = [];
  const now = () => Date.now();
  let start = now();
  steps.push({ step: 'typecheck', success: true, durationMs: now() - start, output: 'Typecheck passed (simulated).' });
  start = now();
  const lintSuccess = changedFiles.length < 50;
  steps.push({ step: 'lint', success: lintSuccess, durationMs: now() - start, output: lintSuccess ? 'ESLint clean (simulated).' : 'Too many files changed (simulated lint failure).' });
  start = now();
  steps.push({ step: 'tests', success: true, durationMs: now() - start, output: 'Focused tests passed (simulated).' });
  return { steps, allPassed: steps.every(s => s.success) };
}

async function runRealValidation(changedFiles: string[]): Promise<ValidationSummary> {
  const steps: ValidationStepResult[] = [];
  const now = () => Date.now();

  // TypeScript compile (no emit)
  let start = now();
  const tsc = await runCmd('npx', ['tsc', '--noEmit', '--project', 'tsconfig.json']);
  steps.push({ step: 'typecheck', success: tsc.code === 0, durationMs: now() - start, output: truncate(tsc.stdout + tsc.stderr) });

  // ESLint (only changed files if within reasonable count, else entire project)
  start = now();
  const lintTargets = changedFiles.length > 0 && changedFiles.length < 25 ? changedFiles : ['.'];
  const eslint = await runCmd('npx', ['eslint', '--max-warnings=0', ...lintTargets]);
  steps.push({ step: 'lint', success: eslint.code === 0, durationMs: now() - start, output: truncate(eslint.stdout + eslint.stderr) });

  // Focused Jest: map files to potential test names (simple heuristic) else full --passWithNoTests
  start = now();
  const testArgs = ['jest', '--runInBand', '--passWithNoTests'];
  const candidateTests = changedFiles
    .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map(f => f.replace(/src\//, ''))
    .slice(0, 20);
  if (candidateTests.length && candidateTests.length < 20) testArgs.push(...candidateTests);
  const jest = await runCmd('npx', testArgs);
  steps.push({ step: 'tests', success: jest.code === 0, durationMs: now() - start, output: truncate(jest.stdout + jest.stderr) });

  return { steps, allPassed: steps.every(s => s.success) };
}

interface CmdResult { code: number; stdout: string; stderr: string }
function truncate(s: string, max = 4000): string { return s.length > max ? s.slice(0, max) + '\n...[truncated]...' : s; }

async function runCmd(cmd: string, args: string[]): Promise<CmdResult> {
  // Dynamic import to avoid overhead if not needed
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => resolve({ code: code ?? 1, stdout, stderr }));
    child.on('error', () => resolve({ code: 1, stdout, stderr: stderr + 'Spawn error' }));
  });
}
