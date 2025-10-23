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
import type { CommandContext } from '@/lib/command-handlers/types';

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

    // Remove action handlers before sending to client
    // Functions cannot be serialized and will be lost anyway
    const sanitizedResult = {
      ...result,
      actions: undefined, // Remove actions as handlers won't work over HTTP
    };

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
