import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const timeframe = searchParams.get('timeframe') || '30'; // days

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const days = parseInt(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.log(`Fetching analytics for project: ${projectId}, timeframe: ${days} days`);

    // For now, return demo data while the database is being set up
    // This can be replaced with real queries once we have proper data
    const mockData = {
      summary: {
        totalAiFixes: Math.floor(Math.random() * 50) + 10,
        estimatedTimeSaved: Math.floor(Math.random() * 100) + 20,
        successRate: Math.floor(Math.random() * 30) + 70,
        totalAiPrs: Math.floor(Math.random() * 30) + 5,
        mergedAiPrs: Math.floor(Math.random() * 25) + 3,
      },
      activityTrends: Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        return {
          date: date.toISOString().split('T')[0],
          issues: Math.floor(Math.random() * 8),
          pullRequests: Math.floor(Math.random() * 5),
        };
      }),
      metrics: {
        avgResolutionTime: 4.2 + Math.random() * 2,
        issuesResolvedThisWeek: Math.floor(Math.random() * 15) + 5,
        prsCreatedThisWeek: Math.floor(Math.random() * 10) + 2,
      },
      timeframe: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    return NextResponse.json(mockData);

    // TODO: Replace this with real database queries once we have proper data structure
    // For now, we return demo data to show the dashboard functionality
  } catch (error) {
    console.error('Error fetching developer insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch developer insights' },
      { status: 500 }
    );
  }
}