import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceRuleService } from '@/lib/compliance/rule-service';
import { AuditLogService, auditActions, entityTypes } from '@/lib/audit-log-service';

/**
 * GET /api/compliance/rules
 * List compliance rules with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const ruleType = searchParams.get('ruleType') || undefined;
    const enabled = searchParams.get('enabled');
    const organizationId = searchParams.get('organizationId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await ComplianceRuleService.listRules({
      category,
      severity,
      ruleType,
      enabled: enabled !== null ? enabled === 'true' : undefined,
      organizationId,
      projectId,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing compliance rules:', error);
    return NextResponse.json(
      { error: 'Failed to list compliance rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compliance/rules
 * Create a new compliance rule
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      severity,
      ruleType,
      enabled,
      condition,
      action,
      metadata,
      organizationId,
      projectId,
    } = body;

    // Validate required fields
    if (!name || !description || !category || !condition) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: name, description, category, condition',
        },
        { status: 400 }
      );
    }

    const rule = await ComplianceRuleService.createRule({
      name,
      description,
      category,
      severity,
      ruleType,
      enabled,
      condition,
      action,
      metadata,
      organizationId,
      projectId,
      createdBy: session.user.id,
    });

    // Log the action
    await AuditLogService.log({
      userId: session.user.id,
      action: auditActions.SETTINGS_UPDATED,
      entityType: entityTypes.SETTINGS,
      entityId: rule.id,
      description: `Created compliance rule: ${name}`,
      organizationId,
      projectId,
      metadata: { ruleId: rule.id, category, severity },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error creating compliance rule:', error);
    return NextResponse.json(
      { error: 'Failed to create compliance rule' },
      { status: 500 }
    );
  }
}
