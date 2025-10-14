import { NextRequest, NextResponse } from 'next/server';
import { getRealTimeAnalyticsService } from '@/lib/realtime-analytics';

interface SSEParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/projects/[id]/events - Server-Sent Events endpoint for real-time analytics
export async function GET(request: NextRequest, { params }: SSEParams) {
  const { id: projectId } = await params;
  
  // TODO: Add authentication when auth system is configured
  // const session = await getServerSession(authOptions);
  // if (!session?.user) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const realTimeService = getRealTimeAnalyticsService();
    const stream = realTimeService.createConnection(projectId);

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    return NextResponse.json(
      { error: 'Failed to establish real-time connection' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    },
  });
}