import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplianceAuditService } from '@/lib/compliance/audit-service';

/**
 * GET /api/compliance/audits/[id]
 * Get audit details by ID
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

    const audit = await ComplianceAuditService.getAudit(params.id);

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    // Get violations for this audit
    const violations = await ComplianceAuditService.getViolations(
      audit.projectId,
      audit.prNumber
    );

    return NextResponse.json({
      ...audit,
      violations,
    });
  } catch (error) {
    console.error('Error getting compliance audit:', error);
    return NextResponse.json(
      { error: 'Failed to get compliance audit' },
      { status: 500 }
    );
  }
}
