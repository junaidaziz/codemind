import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService, ApiKeyScope } from '@/lib/api-key-service';
import { AuditLogService, auditActions, entityTypes } from '@/lib/audit-log-service';

/**
 * GET /api/api-keys
 * Get all API keys for the current user
 * Query params:
 *   - organizationId: Filter by organization (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get user ID from authentication
    const userId = 'placeholder-user-id';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = request.nextUrl.searchParams.get('organizationId') || undefined;

    const apiKeys = await ApiKeyService.getUserApiKeys(userId, organizationId);

    return NextResponse.json({
      apiKeys,
      total: apiKeys.length,
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/api-keys
 * Create a new API key
 * Body:
 *   - name: Key name
 *   - scopes: Array of scopes (READ, WRITE, ADMIN, DEPLOY, ANALYTICS)
 *   - organizationId: Organization ID (optional)
 *   - projectId: Project ID (optional)
 *   - expiresAt: Expiration date (optional, ISO string)
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Get user ID from authentication
    const userId = 'placeholder-user-id';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, scopes, organizationId, projectId, expiresAt } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      return NextResponse.json(
        { error: 'At least one scope is required' },
        { status: 400 }
      );
    }

    // Validate scopes
    const validScopes = Object.values(ApiKeyScope);
    const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
    
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes: ${invalidScopes.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await ApiKeyService.createApiKey({
      name,
      userId,
      organizationId,
      projectId,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    // Log the creation
    await AuditLogService.log({
      userId,
      action: auditActions.API_KEY_CREATED,
      entityType: entityTypes.API_KEY,
      entityId: result.apiKey.id,
      description: `Created API key: ${name}`,
      organizationId,
      projectId,
      metadata: {
        scopes,
        prefix: result.apiKey.prefix,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      apiKey: result.apiKey,
      key: result.key, // Only returned once!
      warning: 'Save this key securely. It will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
