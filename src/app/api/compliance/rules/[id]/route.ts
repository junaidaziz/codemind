import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceRuleService } from '@/lib/compliance/rule-service';
import { AuditLogService, auditActions, entityTypes } from '@/lib/audit-log-service';

/**
 * GET /api/compliance/rules/[id]
 * Get rule details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rule = await ComplianceRuleService.getRule(params.id);

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error getting compliance rule:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance rule' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/compliance/rules/[id]
 * Update a rule
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    } = body;

    const rule = await ComplianceRuleService.updateRule(params.id, {
      name,
      description,
      category,
      severity,
      ruleType,
      enabled,
      condition,
      action,
      metadata,
    });

    // Log the action
    await AuditLogService.log({
      userId: session.user.id,
      action: auditActions.SETTINGS_UPDATED,
      entityType: entityTypes.SETTINGS,
      entityId: rule.id,
      description: `Updated compliance rule: ${rule.name}`,
      organizationId: rule.organizationId || undefined,
      projectId: rule.projectId || undefined,
      metadata: { ruleId: rule.id, changes: body },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error updating compliance rule:', error);
    return NextResponse.json(
      { error: 'Failed to update compliance rule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/compliance/rules/[id]
 * Delete a rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get rule before deleting for audit log
    const rule = await ComplianceRuleService.getRule(params.id);
    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await ComplianceRuleService.deleteRule(params.id);

    // Log the action
    await AuditLogService.log({
      userId: session.user.id,
      action: auditActions.SETTINGS_UPDATED,
      entityType: entityTypes.SETTINGS,
      entityId: rule.id,
      description: `Deleted compliance rule: ${rule.name}`,
      organizationId: rule.organizationId || undefined,
      projectId: rule.projectId || undefined,
      metadata: { ruleId: rule.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting compliance rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete compliance rule' },
      { status: 500 }
    );
  }
}
