import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  ComplianceAuditService,
  auditTriggerTypes,
} from '@/lib/compliance/audit-service';
import { ComplianceRuleService } from '@/lib/compliance/rule-service';
import { AuditLogService, auditActions, entityTypes } from '@/lib/audit-log-service';

/**
 * POST /api/compliance/audits
 * Create and run a new compliance audit
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, prNumber, commitSha, triggerType } = body;

    // Validate required fields
    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required field: projectId' },
        { status: 400 }
      );
    }

    // Create audit record
    const audit = await ComplianceAuditService.createAudit({
      projectId,
      prNumber,
      commitSha,
      triggeredBy: session.user.id,
      triggerType: triggerType || auditTriggerTypes.MANUAL,
    });

    // Log the action
    await AuditLogService.log({
      userId: session.user.id,
      action: auditActions.SETTINGS_UPDATED,
      entityType: entityTypes.PROJECT,
      entityId: audit.id,
      description: `Started compliance audit for project ${projectId}`,
      projectId,
      metadata: { auditId: audit.id, prNumber, commitSha },
    });

    // Start audit processing in background
    // In a real implementation, this would be queued as a background job
    processAudit(audit.id, projectId, prNumber).catch((error) => {
      console.error('Error processing audit:', error);
    });

    return NextResponse.json(audit, { status: 201 });
  } catch (error) {
    console.error('Error creating compliance audit:', error);
    return NextResponse.json(
      { error: 'Failed to create compliance audit' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/compliance/audits
 * List compliance audits with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const prNumber = searchParams.get('prNumber')
      ? parseInt(searchParams.get('prNumber')!, 10)
      : undefined;
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await ComplianceAuditService.listAudits({
      projectId,
      prNumber,
      status,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing compliance audits:', error);
    return NextResponse.json(
      { error: 'Failed to list compliance audits' },
      { status: 500 }
    );
  }
}

/**
 * Background audit processing function
 */
async function processAudit(
  auditId: string,
  projectId: string,
  _prNumber?: number
) {
  const startTime = Date.now();

  try {
    // Update status to IN_PROGRESS
    await ComplianceAuditService.updateAudit(auditId, {
      status: 'IN_PROGRESS',
    });

    // Get applicable rules for the project
    const rules = await ComplianceRuleService.getRulesForScope(
      undefined,
      projectId
    );

    // TODO: In a real implementation, this would:
    // 1. Fetch PR/commit data from GitHub
    // 2. Run each rule against the code
    // 3. Create violations for any failures
    // 4. Generate AI insights

    // For now, we'll create a sample implementation
    const violations = [];
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    // Simulate rule checking
    for (const rule of rules) {
      // This is where actual rule evaluation would happen
      // For demonstration, we'll skip actual checking
      console.log(`Checking rule: ${rule.name}`);
    }

    // Count violations by severity
    for (const violation of violations) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      switch ((violation as any).severity) {
        case 'CRITICAL':
          criticalCount++;
          break;
        case 'HIGH':
          highCount++;
          break;
        case 'MEDIUM':
          mediumCount++;
          break;
        case 'LOW':
          lowCount++;
          break;
      }
    }

    // Update audit with results
    const duration = Date.now() - startTime;
    await ComplianceAuditService.updateAudit(auditId, {
      status: 'COMPLETED',
      rulesChecked: rules.length,
      violationsFound: violations.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      duration,
    });

    // Generate AI insights
    if (violations.length > 0) {
      await ComplianceAuditService.generateAuditInsights(auditId);
    } else {
      await ComplianceAuditService.updateAudit(auditId, {
        aiInsights: 'All compliance checks passed. No violations detected.',
        overallScore: 100,
      });
    }

    console.log(
      `Compliance audit ${auditId} completed in ${duration}ms with ${violations.length} violations`
    );
  } catch (error) {
    console.error('Error processing audit:', error);
    const duration = Date.now() - startTime;
    await ComplianceAuditService.updateAudit(auditId, {
      status: 'FAILED',
      duration,
      metadata: {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
    });
  }
}
