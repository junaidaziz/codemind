import prisma from '../app/lib/db';

export interface AnalyticsEvent {
  eventType: 'ai_fix_started' | 'ai_fix_completed' | 'ai_fix_failed' | 'pr_created' | 'pr_merged' | 'pr_closed' | 'issue_resolved';
  projectId: string;
  issueId?: string;
  pullRequestId?: string;
  metadata?: Record<string, unknown>;
}

export class AnalyticsTracker {
  /**
   * Track an analytics event
   */
  static async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // For now, just log events - we can enhance this when database schema is ready
      const eventData = {
        projectId: event.projectId,
        eventType: event.eventType,
        issueId: event.issueId,
        pullRequestId: event.pullRequestId,
        timestamp: new Date(),
        metadata: event.metadata,
      };

      // Update aggregated metrics for successful operations
      if (event.eventType === 'ai_fix_completed' && event.metadata) {
        await this.updateProjectMetrics(event.projectId, 'fix_completed', event.metadata);
      }

      if (event.eventType === 'ai_fix_failed') {
        await this.updateProjectMetrics(event.projectId, 'fix_failed', event.metadata || {});
      }

      if (event.eventType === 'pr_created') {
        await this.updateProjectMetrics(event.projectId, 'pr_created', event.metadata || {});
      }

      if (event.eventType === 'pr_merged') {
        await this.updateProjectMetrics(event.projectId, 'pr_merged', event.metadata || {});
      }

      // Log the event for debugging
      console.log(`[Analytics] ${event.eventType}:`, eventData);
    } catch (error) {
      console.error('Error tracking analytics event:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Update project metrics in the existing AutoFixMetrics table
   */
  private static async updateProjectMetrics(
    projectId: string, 
    eventType: 'fix_completed' | 'fix_failed' | 'pr_created' | 'pr_merged',
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Try to find existing metrics for this period
      let metrics = await prisma.autoFixMetrics.findFirst({
        where: {
          projectId,
          period,
          periodStart,
        },
      });

      if (!metrics) {
        // Create new metrics record
        metrics = await prisma.autoFixMetrics.create({
          data: {
            projectId,
            period,
            periodStart,
            periodEnd,
            totalSessions: 0,
            successfulSessions: 0,
            failedSessions: 0,
            totalIssuesDetected: 0,
            totalIssuesFixed: 0,
            totalPRsCreated: 0,
            totalPRsMerged: 0,
          },
        });
      }

      // Update metrics based on event type
      const updateData: Record<string, unknown> = {};

      switch (eventType) {
        case 'fix_completed':
          updateData.totalSessions = metrics.totalSessions + 1;
          updateData.successfulSessions = metrics.successfulSessions + 1;
          updateData.totalIssuesFixed = metrics.totalIssuesFixed + 1;
          if (typeof metadata.confidence === 'number') {
            const newTotal = metrics.successfulSessions + 1;
            const currentAvg = metrics.avgConfidence || 0;
            updateData.avgConfidence = ((currentAvg * metrics.successfulSessions) + metadata.confidence) / newTotal;
          }
          break;

        case 'fix_failed':
          updateData.totalSessions = metrics.totalSessions + 1;
          updateData.failedSessions = metrics.failedSessions + 1;
          break;

        case 'pr_created':
          updateData.totalPRsCreated = metrics.totalPRsCreated + 1;
          break;

        case 'pr_merged':
          updateData.totalPRsMerged = metrics.totalPRsMerged + 1;
          break;
      }

      // Update the metrics
      await prisma.autoFixMetrics.update({
        where: { id: metrics.id },
        data: updateData,
      });
    } catch (error) {
      console.error('Error updating project metrics:', error);
    }
  }

  /**
   * Track AI fix session with detailed metrics
   */
  static async trackAIFixSession(data: {
    projectId: string;
    issueId: string;
    confidence: number;
    timeTaken: number;
    success: boolean;
    errorMessage?: string;
    prUrl?: string;
  }): Promise<void> {
    try {
      // Track as an event
      await this.trackEvent({
        eventType: data.success ? 'ai_fix_completed' : 'ai_fix_failed',
        projectId: data.projectId,
        issueId: data.issueId,
        metadata: {
          confidence: data.confidence,
          timeTaken: data.timeTaken,
          prUrl: data.prUrl,
          error: data.errorMessage,
        },
      });
    } catch (error) {
      console.error('Error tracking AI fix session:', error);
    }
  }

  /**
   * Calculate estimated time saved based on issue complexity
   */
  static calculateTimeSaved(issue: {
    title: string;
    body: string;
    labels: string[];
  }): number {
    let baseTime = 2; // Base 2 hours for a typical fix
    
    // Adjust based on complexity indicators
    const complexityIndicators = [
      'bug', 'critical', 'urgent', 'breaking',
      'performance', 'security', 'database', 'api'
    ];
    
    const enhancementIndicators = [
      'enhancement', 'feature', 'improvement', 'optimization'
    ];

    const labels = issue.labels.map(l => l.toLowerCase());
    const titleLower = issue.title.toLowerCase();
    const bodyLower = (issue.body || '').toLowerCase();

    // Check for complexity indicators
    const complexityScore = complexityIndicators.reduce((score, indicator) => {
      if (labels.includes(indicator) || titleLower.includes(indicator) || bodyLower.includes(indicator)) {
        return score + 1;
      }
      return score;
    }, 0);

    // Check for enhancement indicators (usually take more time)
    const enhancementScore = enhancementIndicators.reduce((score, indicator) => {
      if (labels.includes(indicator) || titleLower.includes(indicator) || bodyLower.includes(indicator)) {
        return score + 1;
      }
      return score;
    }, 0);

    // Adjust time based on indicators
    baseTime += complexityScore * 1.5; // Add 1.5 hours per complexity indicator
    baseTime += enhancementScore * 3; // Add 3 hours per enhancement indicator

    // Cap at reasonable limits
    return Math.min(Math.max(baseTime, 1), 12); // Between 1-12 hours
  }

  /**
   * Track pull request events
   */
  static async trackPullRequestEvent(data: {
    projectId: string;
    pullRequestId: string;
    issueId?: string;
    eventType: 'pr_created' | 'pr_merged' | 'pr_closed';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.trackEvent({
      eventType: data.eventType,
      projectId: data.projectId,
      issueId: data.issueId,
      pullRequestId: data.pullRequestId,
      metadata: data.metadata,
    });
  }

  /**
   * Get analytics summary for a project
   */
  static async getProjectAnalytics(projectId: string, days: number = 30): Promise<{
    totalFixes: number;
    successRate: number;
    avgConfidence: number;
    totalTimeSaved: number;
    avgTimeTaken: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const metrics = await prisma.autoFixMetrics.findMany({
        where: {
          projectId,
          createdAt: { gte: startDate },
        },
      });

      const totalFixes = metrics.reduce((sum, m) => sum + m.totalIssuesFixed, 0);
      const totalSessions = metrics.reduce((sum, m) => sum + m.totalSessions, 0);
      const successfulSessions = metrics.reduce((sum, m) => sum + m.successfulSessions, 0);
      
      const successRate = totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0;
      
      const avgConfidence = metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + (m.avgConfidence || 0), 0) / metrics.length 
        : 0;

      // Estimate time saved (assume each successful fix saves 4 hours on average)
      const totalTimeSaved = totalFixes * 4;
      
      // Estimate average time taken (placeholder for now)
      const avgTimeTaken = 0.5; // 30 minutes average

      return {
        totalFixes,
        successRate,
        avgConfidence,
        totalTimeSaved,
        avgTimeTaken,
      };
    } catch (error) {
      console.error('Error getting project analytics:', error);
      return {
        totalFixes: 0,
        successRate: 0,
        avgConfidence: 0,
        totalTimeSaved: 0,
        avgTimeTaken: 0,
      };
    }
  }
}

export default AnalyticsTracker;