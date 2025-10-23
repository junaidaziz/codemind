import { NextResponse } from 'next/server';
import { aiPromptCache } from '@/lib/ai-prompt-cache';

export async function GET() {
  try {
    const stats = aiPromptCache.getStats();

    return NextResponse.json({
      ...stats,
      topEntries: stats.entries.slice(0, 10), // Top 10 most hit entries
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cache stats' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    aiPromptCache.clear();
    return NextResponse.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
