import { NextResponse } from 'next/server';
import {
  BALANCED_PRESET,
  STRICT_PRESET,
  LENIENT_PRESET,
  type RuleWeightsConfig,
} from '@/lib/code-review/rule-weights-config';

/**
 * GET /api/code-review/rule-weights/presets
 * Get all available rule weight presets
 * 
 * Returns an object with all preset configurations
 */
export async function GET() {
  try {
    const presets: Record<string, RuleWeightsConfig & { description: string }> = {
      balanced: {
        ...BALANCED_PRESET,
        description: 'Balanced preset with moderate risk sensitivity. Suitable for most projects.',
      },
      strict: {
        ...STRICT_PRESET,
        description: 'Strict preset with high risk sensitivity. Recommended for critical production systems.',
      },
      lenient: {
        ...LENIENT_PRESET,
        description: 'Lenient preset with low risk sensitivity. Suitable for experimental or early-stage projects.',
      },
    };

    return NextResponse.json({
      success: true,
      presets,
      default: 'balanced',
    });
  } catch (error) {
    console.error('[Rule Weights] Error fetching presets:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch presets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
