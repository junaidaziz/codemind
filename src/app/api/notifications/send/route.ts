/**
 * Notifications API
 * POST /api/notifications/send
 * Sends notifications via configured providers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNotificationFactory } from '@/lib/notifications';
import type { NotificationPayload } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const payload: NotificationPayload = await request.json();

    // Validate payload
    if (!payload.type || !payload.title || !payload.message) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, message' },
        { status: 400 }
      );
    }

    const factory = getNotificationFactory();

    if (!factory.isAnyProviderConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'No notification providers configured',
          results: [],
        },
        { status: 200 }
      );
    }

    // Send to all configured providers
    const providers = factory.getAllProviders();
    const results = await Promise.all(
      providers.map(async (provider) => {
        const result = await provider.send(payload);
        return {
          provider: provider.name,
          ...result,
        };
      })
    );

    const allSuccessful = results.every((r) => r.success);

    return NextResponse.json({
      success: allSuccessful,
      results,
    });
  } catch (error) {
    console.error('Notification send error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const factory = getNotificationFactory();
    const configuredProviders = factory.getConfiguredProviders();

    return NextResponse.json({
      configured: configuredProviders,
      isConfigured: factory.isAnyProviderConfigured(),
    });
  } catch (error) {
    console.error('Notification status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
