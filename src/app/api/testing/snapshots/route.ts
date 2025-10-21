/**
 * Snapshot Management API Route
 * 
 * GET /api/testing/snapshots - Analyze all snapshots
 * POST /api/testing/snapshots/analyze - Analyze specific changes
 * POST /api/testing/snapshots/suggest - Get AI suggestions
 * POST /api/testing/snapshots/update - Update snapshots
 */

import { NextRequest, NextResponse } from 'next/server';
import { SnapshotManager } from '@/lib/testing/snapshot-manager';
import { AISnapshotAdvisor } from '@/lib/testing/ai-snapshot-advisor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectPath = searchParams.get('projectPath') || process.cwd();
    const action = searchParams.get('action') || 'analyze';

    const manager = new SnapshotManager(projectPath);

    switch (action) {
      case 'analyze': {
        const analysis = await manager.analyze();
        const report = manager.generateReport(analysis);

        return NextResponse.json({
          success: true,
          analysis,
          report,
        });
      }

      case 'list': {
        const snapshots = await manager.findSnapshotFiles();

        return NextResponse.json({
          success: true,
          snapshots,
          total: snapshots.length,
        });
      }

      case 'obsolete': {
        const obsolete = await manager.findObsoleteSnapshots();

        return NextResponse.json({
          success: true,
          obsolete,
          count: obsolete.length,
        });
      }

      case 'changes': {
        const since = searchParams.get('since') || undefined;
        const changes = await manager.detectChanges(since);

        return NextResponse.json({
          success: true,
          changes,
          count: changes.length,
        });
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}. Must be one of: analyze, list, obsolete, changes` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Snapshot analysis error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze snapshots',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectPath, changes, testPattern, updateAll } = body;

    const manager = new SnapshotManager(projectPath || process.cwd());

    switch (action) {
      case 'analyze': {
        const analysis = await manager.analyze();
        const report = manager.generateReport(analysis);

        return NextResponse.json({
          success: true,
          analysis,
          report,
        });
      }

      case 'suggest': {
        if (!changes || !Array.isArray(changes)) {
          return NextResponse.json(
            { error: 'Missing or invalid changes array' },
            { status: 400 }
          );
        }

        const advisor = new AISnapshotAdvisor();
        const result = await advisor.analyzeBatch(changes);

        return NextResponse.json({
          success: true,
          suggestions: result,
        });
      }

      case 'explain': {
        if (!changes || !Array.isArray(changes) || changes.length === 0) {
          return NextResponse.json(
            { error: 'Missing or invalid changes array' },
            { status: 400 }
          );
        }

        const advisor = new AISnapshotAdvisor();
        const explanation = await advisor.explainChange(changes[0]);

        return NextResponse.json({
          success: true,
          explanation,
        });
      }

      case 'update': {
        const result = await manager.updateSnapshots({
          testPattern,
          updateAll,
        });

        return NextResponse.json({
          success: result.success,
          output: result.output,
        });
      }

      case 'improvements': {
        const { testFile, snapshots } = body;

        if (!testFile || !snapshots) {
          return NextResponse.json(
            { error: 'Missing testFile or snapshots' },
            { status: 400 }
          );
        }

        const advisor = new AISnapshotAdvisor();
        const suggestions = await advisor.suggestTestImprovements(
          testFile,
          snapshots
        );

        return NextResponse.json({
          success: true,
          suggestions,
        });
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}. Must be one of: analyze, suggest, explain, update, improvements` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Snapshot management error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process snapshot request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
