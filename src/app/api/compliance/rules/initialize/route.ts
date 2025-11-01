import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initializeDefaultRules } from '@/lib/compliance/rule-utils';
import { AuditLogService, auditActions, entityTypes } from '@/lib/audit-log-service';

/**
 * POST /api/compliance/rules/initialize
 * Initialize default compliance rules for a project or organization
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, projectId, skipExisting = true } = body;

    console.log(
      `Initializing default compliance rules for ${projectId ? 'project ' + projectId : organizationId ? 'organization ' + organizationId : 'global scope'}`
    );

    const results = await initializeDefaultRules(session.user.id, {
      organizationId,
      projectId,
      skipExisting,
    });

    // Log the action
    await AuditLogService.log({
      userId: session.user.id,
      action: auditActions.SETTINGS_UPDATED,
      entityType: entityTypes.SETTINGS,
      entityId: projectId || organizationId || 'global',
      description: `Initialized ${results.created} default compliance rules`,
      organizationId,
      projectId,
      metadata: results,
    });

    return NextResponse.json({
      success: true,
      ...results,
      message: `Successfully initialized ${results.created} rules, skipped ${results.skipped}, ${results.errors} errors`,
    });
  } catch (error) {
    console.error('Error initializing default rules:', error);
    return NextResponse.json(
      { error: 'Failed to initialize default rules' },
      { status: 500 }
    );
  }
}
