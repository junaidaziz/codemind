/**
 * AI Snapshot Advisor
 * 
 * Provides AI-powered suggestions for snapshot updates using OpenAI.
 * Analyzes snapshot diffs and recommends appropriate actions.
 * 
 * @module testing/ai-snapshot-advisor
 */

import OpenAI from 'openai';
import type { SnapshotChange, SnapshotDiff } from './snapshot-manager';

/**
 * AI suggestion for snapshot update
 */
export interface SnapshotSuggestion {
  snapshotFile: string;
  action: 'update' | 'review' | 'reject' | 'delete';
  reason: string;
  confidence: number;
  details: string;
  risks: string[];
  alternatives?: string[];
}

/**
 * Batch suggestion result
 */
export interface BatchSuggestionResult {
  suggestions: SnapshotSuggestion[];
  summary: string;
  safeToAutoUpdate: string[];
  requiresReview: string[];
  shouldReject: string[];
}

/**
 * AI Snapshot Advisor
 */
export class AISnapshotAdvisor {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze snapshot change and provide AI suggestion
   */
  async analyzeSingleChange(
    change: SnapshotChange,
    diff?: SnapshotDiff[]
  ): Promise<SnapshotSuggestion> {
    const prompt = this.buildAnalysisPrompt(change, diff);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '';
      return this.parseSuggestion(change.snapshotFile, content);
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      return this.getFallbackSuggestion(change);
    }
  }

  /**
   * Analyze multiple changes in batch
   */
  async analyzeBatch(
    changes: SnapshotChange[]
  ): Promise<BatchSuggestionResult> {
    const suggestions = await Promise.all(
      changes.map(change => this.analyzeSingleChange(change))
    );

    const safeToAutoUpdate = suggestions
      .filter(s => s.action === 'update' && s.confidence >= 0.8)
      .map(s => s.snapshotFile);

    const requiresReview = suggestions
      .filter(s => s.action === 'review' || (s.action === 'update' && s.confidence < 0.8))
      .map(s => s.snapshotFile);

    const shouldReject = suggestions
      .filter(s => s.action === 'reject' || s.action === 'delete')
      .map(s => s.snapshotFile);

    const summary = this.generateBatchSummary(suggestions);

    return {
      suggestions,
      summary,
      safeToAutoUpdate,
      requiresReview,
      shouldReject,
    };
  }

  /**
   * Get system prompt for AI
   */
  private getSystemPrompt(): string {
    return `You are an expert testing engineer specializing in snapshot testing. Your role is to analyze snapshot changes and provide actionable recommendations.

When analyzing snapshot changes, consider:
1. **Safety**: Is the change safe to auto-update without breaking tests?
2. **Intent**: Does the change reflect intentional code changes or bugs?
3. **Impact**: What's the scope and severity of the change?
4. **Patterns**: Are there recognizable patterns (formatting, data updates, etc.)?

Provide recommendations in this format:
ACTION: [update|review|reject|delete]
CONFIDENCE: [0.0-1.0]
REASON: [Brief explanation]
DETAILS: [Detailed analysis]
RISKS: [Comma-separated list of risks]
ALTERNATIVES: [Optional comma-separated alternatives]

Guidelines:
- "update" = Safe to auto-update (e.g., formatting, expected data changes)
- "review" = Needs manual review before updating (e.g., structural changes)
- "reject" = Should not be updated (e.g., likely indicates a bug)
- "delete" = Snapshot is obsolete and should be removed

Be conservative with "update" recommendations. When in doubt, suggest "review".`;
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(
    change: SnapshotChange,
    diff?: SnapshotDiff[]
  ): string {
    let prompt = `Analyze this snapshot change:\n\n`;
    prompt += `File: ${change.snapshotFile}\n`;
    prompt += `Test File: ${change.testFile}\n`;
    prompt += `Change Type: ${change.changeType}\n`;
    prompt += `Current Recommendation: ${change.recommendation}\n`;
    prompt += `Auto-Update Safe: ${change.autoUpdateSafe}\n\n`;

    if (change.affectedSnapshots.length > 0) {
      prompt += `Affected Snapshots (${change.affectedSnapshots.length}):\n`;
      change.affectedSnapshots.slice(0, 5).forEach(snap => {
        prompt += `- ${snap}\n`;
      });
      if (change.affectedSnapshots.length > 5) {
        prompt += `... and ${change.affectedSnapshots.length - 5} more\n`;
      }
      prompt += '\n';
    }

    if (diff && diff.length > 0) {
      prompt += `Diff Analysis:\n\n`;
      diff.slice(0, 3).forEach(d => {
        prompt += `Snapshot: ${d.snapshotName}\n`;
        prompt += `Category: ${d.category}\n`;
        prompt += `Changes: ${d.diffLines.filter(l => l.type !== 'unchanged').length} lines\n\n`;
        
        // Show first few diff lines
        const relevantLines = d.diffLines
          .filter(l => l.type !== 'unchanged')
          .slice(0, 10);
        
        relevantLines.forEach(line => {
          const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
          prompt += `${prefix} ${line.content}\n`;
        });
        prompt += '\n';
      });

      if (diff.length > 3) {
        prompt += `... and ${diff.length - 3} more snapshots\n\n`;
      }
    }

    prompt += `Based on this information, provide your recommendation for handling this snapshot change.`;

    return prompt;
  }

  /**
   * Parse AI suggestion from response
   */
  private parseSuggestion(
    snapshotFile: string,
    content: string
  ): SnapshotSuggestion {
    const actionMatch = content.match(/ACTION:\s*(update|review|reject|delete)/i);
    const confidenceMatch = content.match(/CONFIDENCE:\s*([\d.]+)/i);
    const reasonMatch = content.match(/REASON:\s*([^\n]+)/i);
    const detailsMatch = content.match(/DETAILS:\s*([^\n]+(?:\n(?!RISKS:)[^\n]+)*)/i);
    const risksMatch = content.match(/RISKS:\s*([^\n]+)/i);
    const alternativesMatch = content.match(/ALTERNATIVES:\s*([^\n]+)/i);

    const action = (actionMatch?.[1]?.toLowerCase() || 'review') as SnapshotSuggestion['action'];
    const confidence = parseFloat(confidenceMatch?.[1] || '0.5');
    const reason = reasonMatch?.[1]?.trim() || 'Unable to determine recommendation';
    const details = detailsMatch?.[1]?.trim() || reason;
    const risks = risksMatch?.[1]
      ?.split(',')
      .map(r => r.trim())
      .filter(Boolean) || [];
    const alternatives = alternativesMatch?.[1]
      ?.split(',')
      .map(a => a.trim())
      .filter(Boolean);

    return {
      snapshotFile,
      action,
      reason,
      confidence,
      details,
      risks,
      alternatives,
    };
  }

  /**
   * Get fallback suggestion when AI fails
   */
  private getFallbackSuggestion(change: SnapshotChange): SnapshotSuggestion {
    let action: SnapshotSuggestion['action'] = 'review';
    let confidence = 0.5;

    if (change.autoUpdateSafe && change.confidence === 'high') {
      action = 'update';
      confidence = 0.7;
    } else if (change.changeType === 'deleted') {
      action = 'delete';
      confidence = 0.6;
    } else if (change.changeType === 'obsolete') {
      action = 'delete';
      confidence = 0.8;
    }

    return {
      snapshotFile: change.snapshotFile,
      action,
      reason: change.recommendation,
      confidence,
      details: 'AI analysis unavailable. Using rule-based recommendation.',
      risks: ['Unable to perform detailed analysis'],
    };
  }

  /**
   * Generate batch summary
   */
  private generateBatchSummary(suggestions: SnapshotSuggestion[]): string {
    const total = suggestions.length;
    const updates = suggestions.filter(s => s.action === 'update').length;
    const reviews = suggestions.filter(s => s.action === 'review').length;
    const rejects = suggestions.filter(s => s.action === 'reject').length;
    const deletes = suggestions.filter(s => s.action === 'delete').length;

    let summary = `Analyzed ${total} snapshot change(s):\n\n`;
    
    if (updates > 0) {
      summary += `✅ ${updates} safe to auto-update\n`;
    }
    
    if (reviews > 0) {
      summary += `👁️ ${reviews} require manual review\n`;
    }
    
    if (rejects > 0) {
      summary += `❌ ${rejects} should be rejected\n`;
    }
    
    if (deletes > 0) {
      summary += `🗑️ ${deletes} should be deleted\n`;
    }

    // Calculate average confidence
    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / total;
    summary += `\nAverage confidence: ${(avgConfidence * 100).toFixed(1)}%`;

    return summary;
  }

  /**
   * Explain snapshot change in human-readable format
   */
  async explainChange(
    change: SnapshotChange,
    diff?: SnapshotDiff[]
  ): Promise<string> {
    const prompt = `Explain this snapshot change in simple terms for a developer:\n\n${this.buildAnalysisPrompt(change, diff)}\n\nProvide a clear, concise explanation of what changed and why it might have changed.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful testing assistant. Explain technical changes in clear, simple language.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content || 'Unable to generate explanation.';
    } catch (error) {
      console.error('Error generating explanation:', error);
      return `The snapshot file ${change.snapshotFile} was ${change.changeType}. ${change.recommendation}`;
    }
  }

  /**
   * Suggest test improvements based on snapshot analysis
   */
  async suggestTestImprovements(
    testFile: string,
    snapshots: SnapshotChange[]
  ): Promise<string[]> {
    const prompt = `Analyze these snapshot changes for test file ${testFile}:\n\n`;
    
    snapshots.forEach(snap => {
      prompt.concat(`- ${snap.snapshotFile}: ${snap.changeType}\n`);
    });

    prompt.concat('\nSuggest 3-5 ways to improve these tests or make snapshots more maintainable.');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert testing engineer. Provide practical, actionable suggestions for test improvements.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Extract numbered suggestions
      const suggestions = content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim());

      return suggestions;
    } catch (error) {
      console.error('Error generating test improvements:', error);
      return [
        'Consider using more specific test assertions instead of full snapshots',
        'Break large snapshots into smaller, focused ones',
        'Add descriptive test names that explain what is being tested',
      ];
    }
  }
}
