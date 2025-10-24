import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/api-key-service';
import { AuditLogService, auditActions, entityTypes } from '@/lib/audit-log-service';

/**
 * GET /api/api-keys/[id]
 * Get API key statistics and details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Get user ID from authentication
    const userId = 'placeholder-user-id';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: keyId } = await params;

    const stats = await ApiKeyService.getApiKeyStats(keyId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching API key stats:', error);
    
    if (error instanceof Error && error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch API key stats' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/api-keys/[id]
 * Revoke or delete an API key
 * Query params:
 *   - permanent: If true, delete the key permanently (default: false, just revoke)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Get user ID from authentication
    const userId = 'placeholder-user-id';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: keyId } = await params;
    const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

    if (permanent) {
      await ApiKeyService.deleteApiKey(keyId, userId);
    } else {
      await ApiKeyService.revokeApiKey(keyId, userId);
    }

    // Log the action
    await AuditLogService.log({
      userId,
      action: auditActions.API_KEY_REVOKED,
      entityType: entityTypes.API_KEY,
      entityId: keyId,
      description: `${permanent ? 'Deleted' : 'Revoked'} API key`,
      metadata: { permanent },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `API key ${permanent ? 'deleted' : 'revoked'} successfully`,
    });
  } catch (error) {
    console.error('Error deleting/revoking API key:', error);
    
    if (error instanceof Error && (error.message?.includes('not found') || error.message?.includes('unauthorized'))) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to revoke/delete API key' },
      { status: 500 }
    );
  }
}
