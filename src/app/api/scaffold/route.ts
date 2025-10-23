/**
 * Scaffold API Route
 * 
 * Handles code scaffolding requests from the command console.
 * Executes the scaffold command handler server-side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-server';
import { getCommandRegistry, initializeCommandHandlers } from '@/lib/command-handlers';
import { CommandType } from '@/lib/command-parser';
import type { CommandContext, CodeChange } from '@/lib/command-handlers/types';

// Global cache for action handlers (use Redis in production)
declare global {
  var _scaffoldActionCache: Map<string, {
    handler: () => Promise<void>;
    context: CommandContext;
    changes?: CodeChange[];
    expiresAt: number;
  }> | undefined;
}

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
    const { description, projectId, workspacePath } = body;

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    if (!projectId || !workspacePath) {
      return NextResponse.json(
        { error: 'Project ID and workspace path are required' },
        { status: 400 }
      );
    }

    // Initialize command handlers if needed
    await initializeCommandHandlers();

    // Get the scaffold handler
    const registry = getCommandRegistry();
    const handler = registry.getHandler(CommandType.SCAFFOLD);

    if (!handler) {
      return NextResponse.json(
        { error: 'Scaffold handler not available' },
        { status: 500 }
      );
    }

    // Create command context
    const context: CommandContext = {
      userId,
      projectId,
      workspacePath,
    };

    // Create command object
    const command = {
      type: CommandType.SCAFFOLD,
      args: [description],
      rawArgs: description,
      context: '',
      originalMessage: `/scaffold ${description}`,
    };

    // Execute the command
    const result = await handler.execute(command, context);

    // Convert action handlers to action IDs that can be executed server-side
    const sanitizedResult = {
      ...result,
      actions: result.actions?.map((action, idx) => ({
        id: `action-${projectId}-${Date.now()}-${idx}`,
        type: action.type,
        label: action.label,
        description: action.description,
      })),
    };

    // Store the original result with handlers in memory for action execution
    // In production, use Redis or database with TTL
    if (result.actions && result.actions.length > 0) {
      if (!global._scaffoldActionCache) {
        global._scaffoldActionCache = new Map();
      }
      sanitizedResult.actions?.forEach((sanitizedAction, idx) => {
        global._scaffoldActionCache!.set(sanitizedAction.id, {
          handler: result.actions![idx].handler,
          context,
          changes: result.changes,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        });
      });
    }

    return NextResponse.json(sanitizedResult);
  } catch (error) {
    console.error('Error executing scaffold command:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to execute scaffold command',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
