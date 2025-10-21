/**
 * Failure Analysis API Route
 * 
 * POST /api/testing/failures/analyze - Analyze test failures
 * POST /api/testing/failures/retry - Retry failed tests
 * POST /api/testing/failures/batch - Batch analyze multiple failures
 */

import { NextRequest, NextResponse } from 'next/server';
import { FailureAnalyzer, type TestFailure, type RetryConfig } from '@/lib/testing/failure-analyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, failure, failures, testFile, testName, retryConfig, generateReport } = body;

    const analyzer = new FailureAnalyzer();

    switch (action) {
      case 'analyze': {
        if (!failure) {
          return NextResponse.json(
            { error: 'Missing failure object' },
            { status: 400 }
          );
        }

        const analysis = await analyzer.analyzeFailure(failure as TestFailure);
        
        let report;
        if (generateReport) {
          report = analyzer.generateReport(analysis);
        }

        return NextResponse.json({
          success: true,
          analysis,
          report,
        });
      }

      case 'batch': {
        if (!failures || !Array.isArray(failures)) {
          return NextResponse.json(
            { error: 'Missing or invalid failures array' },
            { status: 400 }
          );
        }

        const result = await analyzer.analyzeBatch(failures as TestFailure[]);
        
        let report;
        if (generateReport) {
          report = analyzer.generateBatchReport(result);
        }

        return NextResponse.json({
          success: true,
          result,
          report,
        });
      }

      case 'retry': {
        if (!testFile || !testName) {
          return NextResponse.json(
            { error: 'Missing testFile or testName' },
            { status: 400 }
          );
        }

        const config: RetryConfig = retryConfig || {
          maxAttempts: 3,
          delayMs: 1000,
          backoff: 'exponential',
        };

        const retryResult = await analyzer.retryTest(testFile, testName, config);

        return NextResponse.json({
          success: true,
          retryResult,
        });
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}. Must be one of: analyze, batch, retry` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Failure analysis error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze failures',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
