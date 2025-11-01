import { NextRequest, NextResponse } from 'next/server';
import { autoScalingService } from '@/lib/auto-scaling-service';

/**
 * Get auto-scaling recommendations
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const includeImplemented = searchParams.get('includeImplemented') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const recommendations = await autoScalingService.getRecommendations(
      projectId,
      includeImplemented
    );

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

/**
 * Generate new recommendations for a project
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    await autoScalingService.generateRecommendations(projectId);

    return NextResponse.json({ 
      message: 'Recommendations generated successfully',
      status: 'success'
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

/**
 * Update recommendation status
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { recommendationId, action } = body;

    if (!recommendationId || !action) {
      return NextResponse.json(
        { error: 'recommendationId and action are required' },
        { status: 400 }
      );
    }

    if (action === 'implement') {
      await autoScalingService.markImplemented(recommendationId);
    } else if (action === 'dismiss') {
      await autoScalingService.dismissRecommendation(recommendationId);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "implement" or "dismiss"' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      message: `Recommendation ${action}ed successfully`,
      status: 'success'
    });
  } catch (error) {
    console.error('Error updating recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 }
    );
  }
}
