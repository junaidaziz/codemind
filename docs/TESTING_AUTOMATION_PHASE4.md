# Testing Automation - Phase 4: Snapshot Management

> **Status**: ✅ Complete  
> **Phase**: 4 of 5  
> **LOC**: ~550 lines

## Overview

Phase 4 provides intelligent snapshot management with automatic change detection and AI-powered update suggestions. This phase helps teams maintain test snapshots efficiently by identifying obsolete snapshots, analyzing changes, and recommending appropriate actions.

## Architecture

```
┌─────────────────────────────────────────────────┐
│          Snapshot Management System              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │      SnapshotManager                      │ │
│  ├───────────────────────────────────────────┤ │
│  │ - Find snapshot files                     │ │
│  │ - Detect changes via git                  │ │
│  │ - Analyze diffs (formatting/structure)    │ │
│  │ - Find obsolete snapshots                 │ │
│  │ - Update snapshots automatically          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │      AISnapshotAdvisor                    │ │
│  ├───────────────────────────────────────────┤ │
│  │ - AI-powered change analysis              │ │
│  │ - Safety recommendations                  │ │
│  │ - Batch suggestion processing             │ │
│  │ - Human-readable explanations             │ │
│  │ - Test improvement suggestions            │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Features

### 1. Snapshot Discovery & Analysis

- **Find All Snapshots**: Recursively scan project for `.snap` files
- **Change Detection**: Use git to detect added/modified/deleted snapshots
- **Diff Analysis**: Categorize changes (formatting, data, structure, content)
- **Obsolete Detection**: Find snapshots with no corresponding test files
- **Outdated Detection**: Identify snapshots not updated in 6+ months

### 2. AI-Powered Recommendations

- **Safety Analysis**: Determine if changes are safe to auto-update
- **Action Recommendations**: `update`, `review`, `reject`, or `delete`
- **Confidence Scoring**: 0.0-1.0 confidence in recommendations
- **Risk Assessment**: Identify potential risks of updating
- **Alternative Suggestions**: Provide alternative approaches

### 3. Intelligent Change Categorization

- **Formatting Changes**: Whitespace, indentation (safe to update)
- **Data Changes**: Value updates without structure changes
- **Structure Changes**: Object shape, array length modifications
- **Content Changes**: Mixed or complex modifications

### 4. Automated Updates

- **Safe Auto-Update**: Automatically update low-risk changes
- **Pattern-Based Updates**: Update specific test patterns
- **Batch Processing**: Handle multiple snapshots efficiently
- **Git Integration**: Detect changes since specific commits

## Installation

No additional dependencies required. Uses existing `openai` package.

## Usage

### CLI Usage

#### Analyze All Snapshots

```bash
node scripts/snapshot-manager.mjs analyze
```

Output:
```
🔍 Snapshot Manager

Analyzing snapshots...

Found 45 snapshots across 12 files.
✅ All snapshots are up to date.
```

#### Detect Recent Changes

```bash
node scripts/snapshot-manager.mjs changes

# Or compare since specific commit
node scripts/snapshot-manager.mjs changes --since HEAD~5
```

Output:
```
Found 3 change(s):

📝 src/components/__snapshots__/Button.test.tsx.snap
   Type: modified
   Confidence: high
   Auto-update: Yes ✅
   Only formatting changes detected. Safe to auto-update.

👁️ src/pages/__snapshots__/Home.test.tsx.snap
   Type: modified
   Confidence: medium
   Auto-update: No ❌
   Data values changed. Review changes before updating.
```

#### Get AI Suggestions

```bash
node scripts/snapshot-manager.mjs suggest

# With automatic update for safe changes
node scripts/snapshot-manager.mjs suggest --auto-update
```

Output:
```
Getting AI-powered suggestions...

Analyzing 3 change(s)...

Analyzed 3 snapshot change(s):

✅ 1 safe to auto-update
👁️ 2 require manual review

Average confidence: 72.3%
```

#### Update Snapshots

```bash
# Update all snapshots
node scripts/snapshot-manager.mjs update --all

# Update specific test pattern
node scripts/snapshot-manager.mjs update --pattern "components/*.test.ts"
```

#### Find Obsolete Snapshots

```bash
node scripts/snapshot-manager.mjs obsolete
```

Output:
```
Finding obsolete snapshots...

Found 2 obsolete snapshot(s):

  🗑️ src/__snapshots__/OldComponent.test.tsx.snap
  🗑️ tests/__snapshots__/deprecated.test.js.snap

These snapshots have no corresponding test file.
```

#### Explain Changes

```bash
node scripts/snapshot-manager.mjs explain
```

#### Generate Report

```bash
node scripts/snapshot-manager.mjs analyze --report
```

Generates `snapshot-report.md` with full analysis.

### API Usage

#### Programmatic Analysis

```typescript
import { SnapshotManager } from '@/lib/testing/snapshot-manager';

const manager = new SnapshotManager(process.cwd());

// Find all snapshots
const snapshots = await manager.findSnapshotFiles();
console.log(`Found ${snapshots.length} snapshot files`);

// Detect changes
const changes = await manager.detectChanges();
console.log(`${changes.length} snapshots changed`);

// Full analysis
const analysis = await manager.analyze();
console.log(analysis.summary);

// Generate report
const report = manager.generateReport(analysis);
await fs.writeFile('report.md', report);
```

#### AI-Powered Suggestions

```typescript
import { AISnapshotAdvisor } from '@/lib/testing/ai-snapshot-advisor';

const advisor = new AISnapshotAdvisor();

// Analyze single change
const suggestion = await advisor.analyzeSingleChange(change);
console.log(`Action: ${suggestion.action}`);
console.log(`Confidence: ${(suggestion.confidence * 100).toFixed(1)}%`);
console.log(`Reason: ${suggestion.reason}`);

// Batch analysis
const result = await advisor.analyzeBatch(changes);
console.log(`Safe to update: ${result.safeToAutoUpdate.length}`);
console.log(`Needs review: ${result.requiresReview.length}`);

// Get explanation
const explanation = await advisor.explainChange(change);
console.log(explanation);

// Get test improvements
const suggestions = await advisor.suggestTestImprovements(
  'src/components/Button.test.tsx',
  changes
);
```

### REST API Usage

#### GET /api/testing/snapshots

```bash
# Analyze all snapshots
curl "http://localhost:3000/api/testing/snapshots?action=analyze"

# List all snapshots
curl "http://localhost:3000/api/testing/snapshots?action=list"

# Find obsolete snapshots
curl "http://localhost:3000/api/testing/snapshots?action=obsolete"

# Detect changes
curl "http://localhost:3000/api/testing/snapshots?action=changes&since=HEAD~5"
```

#### POST /api/testing/snapshots

```bash
# Get AI suggestions
curl -X POST http://localhost:3000/api/testing/snapshots \
  -H "Content-Type: application/json" \
  -d '{
    "action": "suggest",
    "changes": [...]
  }'

# Explain change
curl -X POST http://localhost:3000/api/testing/snapshots \
  -H "Content-Type: application/json" \
  -d '{
    "action": "explain",
    "changes": [...]
  }'

# Update snapshots
curl -X POST http://localhost:3000/api/testing/snapshots \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "updateAll": true
  }'
```

## API Reference

### SnapshotManager

#### Constructor

```typescript
new SnapshotManager(projectRoot: string)
```

#### Methods

- `findSnapshotFiles(): Promise<SnapshotFile[]>` - Find all snapshot files
- `detectChanges(since?: string): Promise<SnapshotChange[]>` - Detect changes via git
- `findObsoleteSnapshots(): Promise<string[]>` - Find snapshots without tests
- `analyze(): Promise<SnapshotAnalysis>` - Complete snapshot analysis
- `updateSnapshots(options): Promise<{success: boolean; output: string}>` - Update snapshots
- `generateReport(analysis: SnapshotAnalysis): string` - Generate markdown report

### AISnapshotAdvisor

#### Constructor

```typescript
new AISnapshotAdvisor(apiKey?: string)
```

#### Methods

- `analyzeSingleChange(change: SnapshotChange, diff?: SnapshotDiff[]): Promise<SnapshotSuggestion>`
- `analyzeBatch(changes: SnapshotChange[]): Promise<BatchSuggestionResult>`
- `explainChange(change: SnapshotChange, diff?: SnapshotDiff[]): Promise<string>`
- `suggestTestImprovements(testFile: string, snapshots: SnapshotChange[]): Promise<string[]>`

## Data Models

### SnapshotFile

```typescript
interface SnapshotFile {
  filePath: string;
  relativePath: string;
  testFile: string;
  snapshotCount: number;
  lastModified: Date;
  size: number;
}
```

### SnapshotChange

```typescript
interface SnapshotChange {
  snapshotFile: string;
  testFile: string;
  changeType: 'added' | 'modified' | 'deleted' | 'obsolete';
  affectedSnapshots: string[];
  recommendation: string;
  confidence: 'high' | 'medium' | 'low';
  autoUpdateSafe: boolean;
}
```

### SnapshotSuggestion

```typescript
interface SnapshotSuggestion {
  snapshotFile: string;
  action: 'update' | 'review' | 'reject' | 'delete';
  reason: string;
  confidence: number; // 0.0-1.0
  details: string;
  risks: string[];
  alternatives?: string[];
}
```

### SnapshotAnalysis

```typescript
interface SnapshotAnalysis {
  totalSnapshots: number;
  obsoleteSnapshots: string[];
  outdatedSnapshots: string[];
  missingTests: string[];
  recommendations: SnapshotChange[];
  summary: string;
}
```

## Examples

### Example 1: Automated Snapshot Maintenance

```typescript
import { SnapshotManager } from '@/lib/testing/snapshot-manager';
import { AISnapshotAdvisor } from '@/lib/testing/ai-snapshot-advisor';

async function maintainSnapshots() {
  const manager = new SnapshotManager(process.cwd());
  const advisor = new AISnapshotAdvisor();

  // 1. Find obsolete snapshots
  const obsolete = await manager.findObsoleteSnapshots();
  if (obsolete.length > 0) {
    console.log(`Found ${obsolete.length} obsolete snapshots to delete`);
  }

  // 2. Detect changes
  const changes = await manager.detectChanges();
  
  // 3. Get AI suggestions
  const result = await advisor.analyzeBatch(changes);
  
  // 4. Auto-update safe changes
  if (result.safeToAutoUpdate.length > 0) {
    await manager.updateSnapshots({ updateAll: true });
    console.log(`Updated ${result.safeToAutoUpdate.length} snapshots`);
  }
  
  // 5. Report changes needing review
  if (result.requiresReview.length > 0) {
    console.log(`${result.requiresReview.length} snapshots need manual review`);
  }
}
```

### Example 2: Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for snapshot changes
node scripts/snapshot-manager.mjs changes > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "⚠️  Snapshot changes detected. Run 'npm run snapshots:review' to analyze."
fi
```

### Example 3: CI/CD Integration

```yaml
# .github/workflows/snapshots.yml
name: Snapshot Check

on: [pull_request]

jobs:
  check-snapshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Check Snapshots
        run: |
          node scripts/snapshot-manager.mjs changes --since origin/main
          node scripts/snapshot-manager.mjs suggest
```

## Best Practices

1. **Regular Analysis**: Run `analyze` weekly to catch obsolete snapshots
2. **Review AI Suggestions**: Don't blindly trust AI; review recommendations
3. **Incremental Updates**: Update snapshots in small batches
4. **Document Intent**: Add comments explaining complex snapshot changes
5. **Test Coverage**: Ensure tests actually validate behavior, not just structure
6. **Specific Snapshots**: Prefer targeted snapshots over full component trees
7. **Git History**: Review snapshot diffs in PRs carefully

## Limitations

1. **Git Dependency**: Requires git for change detection
2. **Jest/Vitest Only**: Currently supports Jest/Vitest snapshot format
3. **AI Accuracy**: AI suggestions should be reviewed, not blindly applied
4. **Performance**: Large projects may take time to analyze
5. **Snapshot Format**: Assumes standard Jest `.snap` file format
6. **Binary Snapshots**: Cannot analyze binary or image snapshots

## Troubleshooting

### "No snapshots found"

- Ensure you're in the project root
- Check if snapshots use standard `.snap` extension
- Verify snapshots are in `__snapshots__` directories

### "Unable to detect changes"

- Ensure git is installed and repository is initialized
- Check if you have uncommitted changes
- Try specifying `--since` with a valid commit reference

### "AI suggestions unavailable"

- Verify `OPENAI_API_KEY` environment variable is set
- Check OpenAI API quota and rate limits
- Falls back to rule-based suggestions if AI fails

### "Update failed"

- Ensure test framework is configured correctly
- Check if tests can run successfully
- Verify npm/yarn/pnpm is available

## Performance Tips

1. **Use --pattern**: Limit updates to specific test files
2. **Batch Analysis**: Analyze snapshots in groups rather than all at once
3. **Cache Results**: Store analysis results to avoid re-analyzing
4. **Parallel Processing**: Process multiple snapshots concurrently
5. **Skip Directories**: Configure directories to skip (node_modules, etc.)

## Next Steps

After Phase 4, continue to:

- **Phase 5**: Failure Analysis - AI-powered test debugging and automatic retry

## Related Documentation

- [Phase 1: Coverage Analysis Engine](./TESTING_AUTOMATION_PHASE1.md)
- [Phase 2: AI Test Generator](./TESTING_AUTOMATION_PHASE2.md)
- [Phase 3: GitHub Checks Integration](./TESTING_AUTOMATION_PHASE3.md)
- [Jest Snapshot Testing](https://jestjs.io/docs/snapshot-testing)
