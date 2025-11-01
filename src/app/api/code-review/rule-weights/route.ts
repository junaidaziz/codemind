import { NextRequest, NextResponse } from 'next/server';
import type { RuleWeightsConfig } from '@/lib/code-review/rule-weights-config';
import { validateRuleWeights } from '@/lib/code-review/rule-weights-config';

/**
 * GET /api/code-review/rule-weights
 * Validate a custom rule weights configuration
 * 
 * Query params:
 *   config: JSON string of RuleWeightsConfig to validate
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configParam = searchParams.get('config');

    if (!configParam) {
      return NextResponse.json(
        { error: 'Missing config parameter' },
        { status: 400 }
      );
    }

    let config: RuleWeightsConfig;
    try {
      config = JSON.parse(configParam);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in config parameter' },
        { status: 400 }
      );
    }

    const validation = validateRuleWeights(config);

    return NextResponse.json({
      valid: validation.valid,
      errors: validation.errors,
    });
  } catch (error) {
    console.error('[Rule Weights] Error validating config:', error);
    return NextResponse.json(
      {
        error: 'Failed to validate configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/code-review/rule-weights
 * Validate and return a custom rule weights configuration
 * (For now, this just validates. In future, we could store in database)
 * 
 * Body: RuleWeightsConfig object
 */
export async function POST(request: NextRequest) {
  try {
    const config: RuleWeightsConfig = await request.json();

    const validation = validateRuleWeights(config);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid configuration',
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // In the future, we could store this in the database here
    // For now, just return the validated config
    return NextResponse.json({
      success: true,
      config,
      message: 'Configuration validated successfully',
    });
  } catch (error) {
    console.error('[Rule Weights] Error processing config:', error);
    return NextResponse.json(
      {
        error: 'Failed to process configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
