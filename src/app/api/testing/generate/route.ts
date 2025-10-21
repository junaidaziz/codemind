/**
 * Test Generation API
 * 
 * Provides endpoints for AI-powered test generation.
 * 
 * @route POST /api/testing/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { TestGenerationOrchestrator } from '@/lib/testing/test-generation-orchestrator';
import type { TestGenerationOptions } from '@/lib/testing/ai-test-generator';

/**
 * POST /api/testing/generate
 * 
 * Generate tests for specified files
 * 
 * Body:
 * - projectId: Project ID (required)
 * - files: Array of file paths (optional, defaults to high priority)
 * - options: Test generation options (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, files, options = {} } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const orchestrator = new TestGenerationOrchestrator(
      projectRoot,
      process.env.OPENAI_API_KEY
    );

    let result;

    if (files && Array.isArray(files) && files.length > 0) {
      // Generate for specific files
      result = await orchestrator.generateForFiles(
        files,
        options as Partial<TestGenerationOptions>
      );
    } else {
      // Generate for high priority files
      result = await orchestrator.generateForHighPriority(
        options as Partial<TestGenerationOptions>
      );
    }

    return NextResponse.json({
      success: true,
      result,
      stats: {
        totalFiles: result.totalFiles,
        successCount: result.successCount,
        failureCount: result.failureCount,
        totalTests: result.totalTests,
        duration: result.duration,
      },
      summary: result.summary,
    });

  } catch (error) {
    console.error('Test generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate tests',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/testing/generate
 * 
 * Get test generation statistics
 * 
 * Query parameters:
 * - projectId: Project ID (required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const orchestrator = new TestGenerationOrchestrator(
      projectRoot,
      process.env.OPENAI_API_KEY
    );

    const statistics = await orchestrator.getStatistics();

    return NextResponse.json({
      success: true,
      statistics,
      message: `Ready to generate approximately ${statistics.estimatedTestCount} tests for ${statistics.untestedFiles} files`,
    });

  } catch (error) {
    console.error('Statistics retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
