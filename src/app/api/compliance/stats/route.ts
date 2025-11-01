import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceRuleService } from '@/lib/compliance/rule-service';
import { ComplianceAuditService } from '@/lib/compliance/audit-service';

/**
 * GET /api/compliance/stats
 * Get compliance statistics and dashboard metrics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Get rule statistics
    const ruleStats = await ComplianceRuleService.getRuleStats(
      organizationId,
      projectId
    );

    // Get audit statistics if projectId is provided
    let auditStats = null;
    if (projectId) {
      auditStats = await ComplianceAuditService.getAuditStats(projectId, days);
    }

    // Get recent audits
    const recentAudits = await ComplianceAuditService.listAudits({
      projectId,
      limit: 10,
      offset: 0,
    });

    // Calculate overall compliance health
    const overallHealth = calculateComplianceHealth(
      ruleStats,
      auditStats
    );

    return NextResponse.json({
      rules: ruleStats,
      audits: auditStats,
      recentAudits: recentAudits.audits,
      overallHealth,
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      },
    });
  } catch (error) {
    console.error('Error getting compliance stats:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance stats' },
      { status: 500 }
    );
  }
}

/**
 * Calculate overall compliance health score
 */
function calculateComplianceHealth(
  ruleStats: {
    total: number;
    enabled: number;
    disabled: number;
  },
  auditStats: {
    total: number;
    completed: number;
    failed: number;
    averageScore: number;
  } | null
) {
  const healthMetrics = {
    score: 0,
    status: 'UNKNOWN' as 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN',
    activeRules: ruleStats.enabled,
    totalRules: ruleStats.total,
    recentAudits: auditStats?.total || 0,
    averageAuditScore: auditStats?.averageScore || 0,
    failureRate: 0,
  };

  if (!auditStats) {
    healthMetrics.status = 'UNKNOWN';
    return healthMetrics;
  }

  // Calculate failure rate
  if (auditStats.total > 0) {
    healthMetrics.failureRate = auditStats.failed / auditStats.total;
  }

  // Calculate overall score based on:
  // - Average audit score (50% weight)
  // - Active rules coverage (20% weight)
  // - Success rate (30% weight)
  const auditScoreComponent = auditStats.averageScore * 0.5;
  const rulesComponent =
    ruleStats.total > 0 ? (ruleStats.enabled / ruleStats.total) * 100 * 0.2 : 0;
  const successRateComponent = (1 - healthMetrics.failureRate) * 100 * 0.3;

  healthMetrics.score = Math.round(
    auditScoreComponent + rulesComponent + successRateComponent
  );

  // Determine status based on score
  if (healthMetrics.score >= 90) {
    healthMetrics.status = 'EXCELLENT';
  } else if (healthMetrics.score >= 75) {
    healthMetrics.status = 'GOOD';
  } else if (healthMetrics.score >= 60) {
    healthMetrics.status = 'FAIR';
  } else {
    healthMetrics.status = 'POOR';
  }

  return healthMetrics;
}
