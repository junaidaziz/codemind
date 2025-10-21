/**
 * Snapshot Manager
 * 
 * Detects and manages test snapshot changes across the codebase.
 * Provides AI-powered suggestions for snapshot updates.
 * 
 * @module testing/snapshot-manager
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Snapshot file information
 */
export interface SnapshotFile {
  filePath: string;
  relativePath: string;
  testFile: string;
  snapshotCount: number;
  lastModified: Date;
  size: number;
}

/**
 * Snapshot change detection result
 */
export interface SnapshotChange {
  snapshotFile: string;
  testFile: string;
  changeType: 'added' | 'modified' | 'deleted' | 'obsolete';
  affectedSnapshots: string[];
  recommendation: string;
  confidence: 'high' | 'medium' | 'low';
  autoUpdateSafe: boolean;
}

/**
 * Snapshot diff information
 */
export interface SnapshotDiff {
  snapshotName: string;
  oldValue: string;
  newValue: string;
  diffLines: DiffLine[];
  category: 'content' | 'formatting' | 'structure' | 'data';
}

/**
 * Diff line
 */
export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

/**
 * Snapshot analysis result
 */
export interface SnapshotAnalysis {
  totalSnapshots: number;
  obsoleteSnapshots: string[];
  outdatedSnapshots: string[];
  missingTests: string[];
  recommendations: SnapshotChange[];
  summary: string;
}

/**
 * Snapshot Manager
 */
export class SnapshotManager {
  constructor(private projectRoot: string) {}

  /**
   * Find all snapshot files in project
   */
  async findSnapshotFiles(): Promise<SnapshotFile[]> {
    const snapshots: SnapshotFile[] = [];
    
    await this.scanDirectory(this.projectRoot, snapshots);
    
    return snapshots;
  }

  /**
   * Recursively scan directory for snapshot files
   */
  private async scanDirectory(dir: string, snapshots: SnapshotFile[]): Promise<void> {
    try {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules, .git, etc.
        if (this.shouldSkipDirectory(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Check if it's a __snapshots__ directory
          if (entry.name === '__snapshots__') {
            await this.processSnapshotDirectory(fullPath, snapshots);
          } else {
            await this.scanDirectory(fullPath, snapshots);
          }
        } else if (entry.name.endsWith('.snap')) {
          // Inline snapshot file
          await this.processSnapshotFile(fullPath, dir, snapshots);
        }
      }
    } catch (error) {
      // Ignore permission errors
      if ((error as NodeJS.ErrnoException).code !== 'EACCES') {
        console.warn(`Error scanning directory ${dir}:`, error);
      }
    }
  }

  /**
   * Check if directory should be skipped
   */
  private shouldSkipDirectory(name: string): boolean {
    return [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      'coverage',
      '.turbo',
    ].includes(name);
  }

  /**
   * Process snapshot directory
   */
  private async processSnapshotDirectory(
    snapshotDir: string,
    snapshots: SnapshotFile[]
  ): Promise<void> {
    const entries = await fsPromises.readdir(snapshotDir);

    for (const entry of entries) {
      if (entry.endsWith('.snap')) {
        const fullPath = path.join(snapshotDir, entry);
        const testDir = path.dirname(snapshotDir);
        await this.processSnapshotFile(fullPath, testDir, snapshots);
      }
    }
  }

  /**
   * Process individual snapshot file
   */
  private async processSnapshotFile(
    filePath: string,
    testDir: string,
    snapshots: SnapshotFile[]
  ): Promise<void> {
    try {
      const stats = await fsPromises.stat(filePath);
      const content = await fsPromises.readFile(filePath, 'utf-8');
      
      // Count snapshots (exports statements)
      const snapshotCount = (content.match(/exports\[`/g) || []).length;
      
      // Find corresponding test file
      const testFile = this.findTestFile(filePath, testDir);

      snapshots.push({
        filePath,
        relativePath: path.relative(this.projectRoot, filePath),
        testFile,
        snapshotCount,
        lastModified: stats.mtime,
        size: stats.size,
      });
    } catch (error) {
      console.warn(`Error processing snapshot file ${filePath}:`, error);
    }
  }

  /**
   * Find corresponding test file for snapshot
   */
  private findTestFile(snapshotPath: string, testDir: string): string {
    const snapshotName = path.basename(snapshotPath, '.snap');
    
    // Common test file patterns
    const patterns = [
      snapshotName,
      snapshotName.replace('.test', ''),
      snapshotName.replace('.spec', ''),
    ];

    for (const pattern of patterns) {
      const testPath = path.join(testDir, pattern);
      if (this.fileExistsSync(testPath)) {
        return testPath;
      }
    }

    return 'unknown';
  }

  /**
   * Check if file exists synchronously
   */
  private fileExistsSync(filePath: string): boolean {
    try {
      fs.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect snapshot changes using git
   */
  async detectChanges(since?: string): Promise<SnapshotChange[]> {
    const changes: SnapshotChange[] = [];
    
    try {
      // Get changed snapshot files
      const gitDiff = since 
        ? `git diff ${since} --name-status --diff-filter=AMDR -- "**/*.snap"`
        : `git diff HEAD --name-status --diff-filter=AMDR -- "**/*.snap"`;
      
      const { stdout } = await execAsync(gitDiff, { cwd: this.projectRoot });
      
      if (!stdout.trim()) {
        return changes;
      }

      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        const [status, filePath] = line.split('\t');
        const fullPath = path.join(this.projectRoot, filePath);
        
        const change = await this.analyzeSnapshotChange(
          fullPath,
          this.mapGitStatusToChangeType(status)
        );
        
        if (change) {
          changes.push(change);
        }
      }
    } catch (error) {
      console.warn('Error detecting snapshot changes:', error);
    }

    return changes;
  }

  /**
   * Map git status to change type
   */
  private mapGitStatusToChangeType(status: string): SnapshotChange['changeType'] {
    switch (status) {
      case 'A':
        return 'added';
      case 'M':
        return 'modified';
      case 'D':
        return 'deleted';
      default:
        return 'modified';
    }
  }

  /**
   * Analyze snapshot change and provide recommendation
   */
  private async analyzeSnapshotChange(
    snapshotPath: string,
    changeType: SnapshotChange['changeType']
  ): Promise<SnapshotChange | null> {
    try {
      const relativePath = path.relative(this.projectRoot, snapshotPath);
      const testFile = this.findTestFile(
        snapshotPath,
        path.dirname(path.dirname(snapshotPath))
      );

      let affectedSnapshots: string[] = [];
      let recommendation = '';
      let confidence: SnapshotChange['confidence'] = 'medium';
      let autoUpdateSafe = false;

      if (changeType === 'added') {
        recommendation = 'New snapshot file created. Review to ensure it captures expected output.';
        confidence = 'high';
        autoUpdateSafe = true;
      } else if (changeType === 'modified') {
        // Analyze the diff to determine if it's safe to auto-update
        const analysis = await this.analyzeSnapshotDiff(snapshotPath);
        affectedSnapshots = analysis.affectedSnapshots;
        recommendation = analysis.recommendation;
        confidence = analysis.confidence;
        autoUpdateSafe = analysis.autoUpdateSafe;
      } else if (changeType === 'deleted') {
        recommendation = 'Snapshot file deleted. Verify if corresponding test was also removed.';
        confidence = 'medium';
        autoUpdateSafe = false;
      }

      return {
        snapshotFile: relativePath,
        testFile,
        changeType,
        affectedSnapshots,
        recommendation,
        confidence,
        autoUpdateSafe,
      };
    } catch (error) {
      console.warn(`Error analyzing snapshot change for ${snapshotPath}:`, error);
      return null;
    }
  }

  /**
   * Analyze snapshot diff to determine safety
   */
  private async analyzeSnapshotDiff(snapshotPath: string): Promise<{
    affectedSnapshots: string[];
    recommendation: string;
    confidence: SnapshotChange['confidence'];
    autoUpdateSafe: boolean;
  }> {
    try {
      const { stdout } = await execAsync(
        `git diff HEAD -- "${snapshotPath}"`,
        { cwd: this.projectRoot }
      );

      const diffs = this.parseSnapshotDiff(stdout);
      const affectedSnapshots = diffs.map(d => d.snapshotName);

      // Analyze diff patterns
      const hasOnlyFormattingChanges = diffs.every(d => d.category === 'formatting');
      const hasOnlyDataChanges = diffs.every(d => d.category === 'data');
      const hasStructuralChanges = diffs.some(d => d.category === 'structure');

      let recommendation = '';
      let confidence: SnapshotChange['confidence'] = 'medium';
      let autoUpdateSafe = false;

      if (hasOnlyFormattingChanges) {
        recommendation = 'Only formatting changes detected (whitespace, indentation). Safe to auto-update.';
        confidence = 'high';
        autoUpdateSafe = true;
      } else if (hasOnlyDataChanges && !hasStructuralChanges) {
        recommendation = 'Data values changed without structural modifications. Review changes and update if expected.';
        confidence = 'medium';
        autoUpdateSafe = false;
      } else if (hasStructuralChanges) {
        recommendation = 'Structural changes detected. Manual review required before updating.';
        confidence = 'low';
        autoUpdateSafe = false;
      } else {
        recommendation = 'Mixed changes detected. Review carefully before updating.';
        confidence = 'low';
        autoUpdateSafe = false;
      }

      return {
        affectedSnapshots,
        recommendation,
        confidence,
        autoUpdateSafe,
      };
    } catch {
      return {
        affectedSnapshots: [],
        recommendation: 'Unable to analyze diff. Manual review recommended.',
        confidence: 'low',
        autoUpdateSafe: false,
      };
    }
  }

  /**
   * Parse snapshot diff output
   */
  private parseSnapshotDiff(diffOutput: string): SnapshotDiff[] {
    const diffs: SnapshotDiff[] = [];
    const lines = diffOutput.split('\n');

    let currentSnapshot: Partial<SnapshotDiff> | null = null;
    let oldValue = '';
    let newValue = '';
    let diffLines: DiffLine[] = [];
    let lineNumber = 0;

    for (const line of lines) {
      // Detect snapshot name
      if (line.includes('exports[`')) {
        if (currentSnapshot) {
          // Save previous snapshot
          diffs.push({
            snapshotName: currentSnapshot.snapshotName!,
            oldValue,
            newValue,
            diffLines,
            category: this.categorizeChange(oldValue, newValue),
          });
        }

        // Start new snapshot
        const match = line.match(/exports\[`([^`]+)`\]/);
        currentSnapshot = {
          snapshotName: match ? match[1] : 'unknown',
        };
        oldValue = '';
        newValue = '';
        diffLines = [];
        lineNumber = 0;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        oldValue += line.substring(1) + '\n';
        diffLines.push({
          type: 'removed',
          content: line.substring(1),
          lineNumber: lineNumber++,
        });
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        newValue += line.substring(1) + '\n';
        diffLines.push({
          type: 'added',
          content: line.substring(1),
          lineNumber: lineNumber++,
        });
      } else if (line.startsWith(' ')) {
        diffLines.push({
          type: 'unchanged',
          content: line.substring(1),
          lineNumber: lineNumber++,
        });
      }
    }

    // Save last snapshot
    if (currentSnapshot) {
      diffs.push({
        snapshotName: currentSnapshot.snapshotName!,
        oldValue,
        newValue,
        diffLines,
        category: this.categorizeChange(oldValue, newValue),
      });
    }

    return diffs;
  }

  /**
   * Categorize change type
   */
  private categorizeChange(oldValue: string, newValue: string): SnapshotDiff['category'] {
    // Check if only whitespace changed
    if (oldValue.replace(/\s/g, '') === newValue.replace(/\s/g, '')) {
      return 'formatting';
    }

    // Check if structure changed (braces, brackets, etc.)
    const oldStructure = oldValue.match(/[{}[\]()]/g)?.join('') || '';
    const newStructure = newValue.match(/[{}[\]()]/g)?.join('') || '';
    
    if (oldStructure !== newStructure) {
      return 'structure';
    }

    // Check if only values changed
    const oldKeys = oldValue.match(/\w+:/g)?.sort().join('') || '';
    const newKeys = newValue.match(/\w+:/g)?.sort().join('') || '';
    
    if (oldKeys === newKeys) {
      return 'data';
    }

    return 'content';
  }

  /**
   * Find obsolete snapshots (no corresponding test)
   */
  async findObsoleteSnapshots(): Promise<string[]> {
    const snapshots = await this.findSnapshotFiles();
    const obsolete: string[] = [];

    for (const snapshot of snapshots) {
      if (snapshot.testFile === 'unknown') {
        obsolete.push(snapshot.relativePath);
        continue;
      }

      // Check if test file exists
      try {
        await fsPromises.access(snapshot.testFile);
      } catch {
        obsolete.push(snapshot.relativePath);
      }
    }

    return obsolete;
  }

  /**
   * Analyze all snapshots in project
   */
  async analyze(): Promise<SnapshotAnalysis> {
    const snapshots = await this.findSnapshotFiles();
    const obsolete = await this.findObsoleteSnapshots();
    const changes = await this.detectChanges();

    const totalSnapshots = snapshots.reduce((sum, s) => sum + s.snapshotCount, 0);

    // Find outdated snapshots (not modified in last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const outdated = snapshots
      .filter(s => s.lastModified < sixMonthsAgo)
      .map(s => s.relativePath);

    // Find missing test files
    const missingTests = snapshots
      .filter(s => s.testFile === 'unknown')
      .map(s => s.relativePath);

    let summary = `Found ${totalSnapshots} snapshots across ${snapshots.length} files.\n`;
    
    if (obsolete.length > 0) {
      summary += `⚠️ ${obsolete.length} obsolete snapshot(s) detected.\n`;
    }
    
    if (outdated.length > 0) {
      summary += `📅 ${outdated.length} snapshot(s) not updated in 6+ months.\n`;
    }
    
    if (changes.length > 0) {
      summary += `🔄 ${changes.length} snapshot(s) changed since last commit.\n`;
    }

    if (obsolete.length === 0 && outdated.length === 0 && changes.length === 0) {
      summary += `✅ All snapshots are up to date.`;
    }

    return {
      totalSnapshots,
      obsoleteSnapshots: obsolete,
      outdatedSnapshots: outdated,
      missingTests,
      recommendations: changes,
      summary,
    };
  }

  /**
   * Update snapshots automatically
   */
  async updateSnapshots(options: {
    testPattern?: string;
    updateAll?: boolean;
  } = {}): Promise<{ success: boolean; output: string }> {
    try {
      const args = ['test', '--', '-u'];
      
      if (options.testPattern) {
        args.push(options.testPattern);
      }
      
      if (options.updateAll) {
        args.push('--updateSnapshot');
      }

      const { stdout, stderr } = await execAsync(
        `npm ${args.join(' ')}`,
        { cwd: this.projectRoot }
      );

      return {
        success: true,
        output: stdout || stderr,
      };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate snapshot update report
   */
  generateReport(analysis: SnapshotAnalysis): string {
    let report = '# Snapshot Analysis Report\n\n';
    
    report += `**Total Snapshots:** ${analysis.totalSnapshots}\n`;
    report += `**Snapshot Files:** ${analysis.obsoleteSnapshots.length + analysis.recommendations.length}\n\n`;

    if (analysis.obsoleteSnapshots.length > 0) {
      report += '## 🗑️ Obsolete Snapshots\n\n';
      report += 'These snapshot files have no corresponding test file:\n\n';
      analysis.obsoleteSnapshots.forEach(snap => {
        report += `- \`${snap}\`\n`;
      });
      report += '\n**Recommendation:** Delete these files or create corresponding tests.\n\n';
    }

    if (analysis.outdatedSnapshots.length > 0) {
      report += '## 📅 Outdated Snapshots\n\n';
      report += 'These snapshots haven\'t been updated in 6+ months:\n\n';
      analysis.outdatedSnapshots.forEach(snap => {
        report += `- \`${snap}\`\n`;
      });
      report += '\n**Recommendation:** Review tests to ensure they\'re still relevant.\n\n';
    }

    if (analysis.recommendations.length > 0) {
      report += '## 🔄 Recent Changes\n\n';
      analysis.recommendations.forEach(change => {
        const emoji = change.changeType === 'added' ? '✨' : 
                     change.changeType === 'modified' ? '📝' : 
                     change.changeType === 'deleted' ? '🗑️' : '⚠️';
        
        report += `### ${emoji} ${change.snapshotFile}\n\n`;
        report += `**Change Type:** ${change.changeType}\n`;
        report += `**Test File:** \`${change.testFile}\`\n`;
        report += `**Confidence:** ${change.confidence}\n`;
        report += `**Auto-Update Safe:** ${change.autoUpdateSafe ? '✅' : '❌'}\n\n`;
        report += `**Recommendation:** ${change.recommendation}\n\n`;
        
        if (change.affectedSnapshots.length > 0) {
          report += '**Affected Snapshots:**\n';
          change.affectedSnapshots.forEach(snap => {
            report += `- ${snap}\n`;
          });
          report += '\n';
        }
      });
    }

    report += '---\n';
    report += `*Generated: ${new Date().toISOString()}*\n`;

    return report;
  }
}
