/**
 * Scaffold Action Execution API
 * 
 * Executes server-side actions for scaffold commands
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { actionId } = body;

    if (!actionId) {
      return NextResponse.json(
        { error: 'Action ID is required' },
        { status: 400 }
      );
    }

    // Get action from cache
    const cache = global._scaffoldActionCache;
    if (!cache) {
      return NextResponse.json(
        { error: 'No actions available' },
        { status: 404 }
      );
    }

    const actionData = cache.get(actionId);
    if (!actionData) {
      return NextResponse.json(
        { error: 'Action not found or expired' },
        { status: 404 }
      );
    }

    // Check if action has expired
    if (Date.now() > actionData.expiresAt) {
      cache.delete(actionId);
      return NextResponse.json(
        { error: 'Action has expired' },
        { status: 410 }
      );
    }

    // Verify user has permission (action belongs to same user)
    if (actionData.context.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to execute this action' },
        { status: 403 }
      );
    }

    // Execute the action
    await actionData.handler();

    // Clean up the action from cache
    cache.delete(actionId);

    return NextResponse.json({
      success: true,
      message: 'Action executed successfully',
    });
  } catch (error) {
    console.error('Error executing scaffold action:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to execute action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
