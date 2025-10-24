import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/api-key-service';
import { AuditLogService, auditActions, entityTypes } from '@/lib/audit-log-service';

/**
 * POST /api/api-keys/[id]/rotate
 * Rotate an API key (create new, revoke old)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id: oldKeyId } = params;

    const result = await ApiKeyService.rotateApiKey(oldKeyId, userId);

    // Log the rotation
    await AuditLogService.log({
      userId,
      action: auditActions.API_KEY_CREATED,
      entityType: entityTypes.API_KEY,
      entityId: result.apiKey.id,
      description: `Rotated API key (old key: ${oldKeyId})`,
      metadata: {
        oldKeyId,
        newKeyId: result.apiKey.id,
        scopes: result.apiKey.scopes,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      apiKey: result.apiKey,
      key: result.key, // Only returned once!
      warning: 'Save this key securely. It will not be shown again.',
      oldKeyRevoked: true,
    }, { status: 201 });
  } catch (error) {
    console.error('Error rotating API key:', error);
    
    if (error instanceof Error && (error.message?.includes('not found') || error.message?.includes('unauthorized'))) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to rotate API key' },
      { status: 500 }
    );
  }
}
