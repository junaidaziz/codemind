import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/db';
import { getUserId } from '@/lib/auth-server';

interface ActivityMetadata {
  testsGenerated?: number;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { format, projectId, startDate, endDate } = body;

    if (!format || !['csv', 'json', 'markdown'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be csv, json, or markdown' },
        { status: 400 }
      );
    }

    // Build filters
    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    } : {};

    const projectFilter = projectId ? { projectId } : {};

    // Fetch all metrics
    const [aiFixes, aiPRs, testGeneration] = await Promise.all([
      prisma.activityEvent.findMany({
        where: {
          userId,
          ...projectFilter,
          ...dateFilter,
          eventType: {
            in: ['AUTO_FIX_STARTED', 'AUTO_FIX_COMPLETED', 'AUTO_FIX_FAILED']
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityEvent.findMany({
        where: {
          userId,
          ...projectFilter,
          ...dateFilter,
          eventType: {
            in: ['APR_PR_CREATED', 'APR_COMPLETED']
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityEvent.findMany({
        where: {
          userId,
          ...projectFilter,
          ...dateFilter,
          eventType: 'TEST_GENERATION',
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Calculate summary
    const totalFixes = aiFixes.length;
    const successfulFixes = aiFixes.filter((a) => a.status === 'COMPLETED').length;
    const failedFixes = aiFixes.filter((a) => a.status === 'FAILED').length;
    const successRate = totalFixes > 0 ? (successfulFixes / totalFixes) * 100 : 0;
    const totalPRs = aiPRs.length;
    const totalTests = testGeneration.reduce((acc: number, activity) => {
      const metadata = activity.metadata as ActivityMetadata;
      return acc + (metadata?.testsGenerated || 0);
    }, 0);

    const avgTimePerFix = 30;
    const avgTimePerPR = 45;
    const avgTimePerTest = 15;
    const timeSaved = 
      (successfulFixes * avgTimePerFix) +
      (totalPRs * avgTimePerPR) +
      (totalTests * avgTimePerTest);

    // Format based on requested type
    if (format === 'csv') {
      const csv = generateCSV({
        summary: {
          totalFixes,
          successfulFixes,
          failedFixes,
          successRate,
          totalPRs,
          totalTests,
          timeSaved,
        },
        fixes: aiFixes,
        prs: aiPRs,
        tests: testGeneration,
      });

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ai-metrics-${Date.now()}.csv"`,
        },
      });
    }

    if (format === 'markdown') {
      const markdown = generateMarkdown({
        summary: {
          totalFixes,
          successfulFixes,
          failedFixes,
          successRate,
          totalPRs,
          totalTests,
          timeSaved,
        },
        fixes: aiFixes,
        prs: aiPRs,
        tests: testGeneration,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="ai-metrics-${Date.now()}.md"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalFixes,
          successfulFixes,
          failedFixes,
          successRate: Math.round(successRate),
          totalPRs,
          totalTests,
          timeSaved,
        },
        fixes: aiFixes.map(f => ({
          id: f.id,
          title: f.title,
          status: f.status,
          duration: f.duration,
          createdAt: f.createdAt.toISOString(),
        })),
        prs: aiPRs.map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
        tests: testGeneration.map(t => ({
          id: t.id,
          title: t.title,
          testsGenerated: (t.metadata as ActivityMetadata)?.testsGenerated || 0,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });

  } catch (error) {
    console.error('Error exporting metrics:', error);
    return NextResponse.json(
      { error: 'Failed to export metrics' },
      { status: 500 }
    );
  }
}

function generateCSV(data: {
  summary: {
    totalFixes: number;
    successfulFixes: number;
    failedFixes: number;
    successRate: number;
    totalPRs: number;
    totalTests: number;
    timeSaved: number;
  };
  fixes: Array<{ id: string; title: string; status: string; duration: number | null; createdAt: Date }>;
  prs: Array<{ id: string; title: string; status: string; createdAt: Date }>;
  tests: Array<{ id: string; title: string; metadata: unknown; createdAt: Date }>;
}): string {
  let csv = 'AI Productivity Metrics Export\n\n';
  
  // Summary section
  csv += 'SUMMARY\n';
  csv += 'Metric,Value\n';
  csv += `Total Fixes,${data.summary.totalFixes}\n`;
  csv += `Successful Fixes,${data.summary.successfulFixes}\n`;
  csv += `Failed Fixes,${data.summary.failedFixes}\n`;
  csv += `Success Rate,${data.summary.successRate.toFixed(2)}%\n`;
  csv += `Total PRs,${data.summary.totalPRs}\n`;
  csv += `Total Tests,${data.summary.totalTests}\n`;
  csv += `Time Saved (minutes),${data.summary.timeSaved}\n\n`;

  // Fixes section
  csv += 'AI FIXES\n';
  csv += 'ID,Title,Status,Duration (ms),Created At\n';
  data.fixes.forEach(fix => {
    const title = fix.title.replace(/,/g, ';');
    csv += `${fix.id},"${title}",${fix.status},${fix.duration || 0},${fix.createdAt.toISOString()}\n`;
  });
  csv += '\n';

  // PRs section
  csv += 'AI PULL REQUESTS\n';
  csv += 'ID,Title,Status,Created At\n';
  data.prs.forEach(pr => {
    const title = pr.title.replace(/,/g, ';');
    csv += `${pr.id},"${title}",${pr.status},${pr.createdAt.toISOString()}\n`;
  });
  csv += '\n';

  // Tests section
  csv += 'TEST GENERATION\n';
  csv += 'ID,Title,Tests Generated,Created At\n';
  data.tests.forEach(test => {
    const title = test.title.replace(/,/g, ';');
    const metadata = test.metadata as ActivityMetadata;
    csv += `${test.id},"${title}",${metadata?.testsGenerated || 0},${test.createdAt.toISOString()}\n`;
  });

  return csv;
}

function generateMarkdown(data: {
  summary: {
    totalFixes: number;
    successfulFixes: number;
    failedFixes: number;
    successRate: number;
    totalPRs: number;
    totalTests: number;
    timeSaved: number;
  };
  fixes: Array<{ id: string; title: string; status: string; duration: number | null; createdAt: Date }>;
  prs: Array<{ id: string; title: string; status: string; createdAt: Date }>;
  tests: Array<{ id: string; title: string; metadata: unknown; createdAt: Date }>;
  startDate?: Date;
  endDate?: Date;
}): string {
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  let md = '# 🤖 AI Productivity Metrics Report\n\n';
  
  if (data.startDate && data.endDate) {
    md += `**Report Period:** ${data.startDate.toLocaleDateString()} - ${data.endDate.toLocaleDateString()}\n\n`;
  }
  
  md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  md += '---\n\n';

  // Summary section
  md += '## 📊 Summary\n\n';
  md += '| Metric | Value |\n';
  md += '|--------|-------|\n';
  md += `| **Total AI Fixes** | ${data.summary.totalFixes} |\n`;
  md += `| **Successful Fixes** | ${data.summary.successfulFixes} ✅ |\n`;
  md += `| **Failed Fixes** | ${data.summary.failedFixes} ❌ |\n`;
  md += `| **Success Rate** | ${data.summary.successRate.toFixed(1)}% |\n`;
  md += `| **PRs Created** | ${data.summary.totalPRs} 🔀 |\n`;
  md += `| **Tests Generated** | ${data.summary.totalTests} 🧪 |\n`;
  md += `| **⏱️ Time Saved** | **${formatDuration(data.summary.timeSaved)}** |\n\n`;

  // Recent fixes
  if (data.fixes.length > 0) {
    md += '## 🔧 Recent AI Fixes\n\n';
    data.fixes.slice(0, 10).forEach(fix => {
      const emoji = fix.status === 'COMPLETED' ? '✅' : fix.status === 'FAILED' ? '❌' : '⏳';
      md += `- ${emoji} **${fix.title}** (${fix.createdAt.toLocaleDateString()})\n`;
      if (fix.duration) {
        md += `  - Duration: ${(fix.duration / 1000).toFixed(1)}s\n`;
      }
    });
    md += '\n';
  }

  // Recent PRs
  if (data.prs.length > 0) {
    md += '## 🔀 AI-Created Pull Requests\n\n';
    data.prs.slice(0, 10).forEach(pr => {
      md += `- **${pr.title}** (${pr.createdAt.toLocaleDateString()})\n`;
    });
    md += '\n';
  }

  // Test generation
  if (data.tests.length > 0) {
    md += '## 🧪 Test Generation Activity\n\n';
    data.tests.slice(0, 10).forEach(test => {
      const metadata = test.metadata as ActivityMetadata;
      md += `- **${test.title}** - ${metadata?.testsGenerated || 0} tests (${test.createdAt.toLocaleDateString()})\n`;
    });
    md += '\n';
  }

  md += '---\n\n';
  md += '_Generated by CodeMind AI Analytics_\n';

  return md;
}

// Slack webhook integration
export async function POST_SLACK(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { webhookUrl, projectId, startDate, endDate } = body;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      );
    }

    // Fetch metrics (similar to above)
    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    } : {};

    const projectFilter = projectId ? { projectId } : {};

    const [aiFixes, aiPRs, testGeneration] = await Promise.all([
      prisma.activityEvent.findMany({
        where: {
          userId,
          ...projectFilter,
          ...dateFilter,
          eventType: {
            in: ['AUTO_FIX_STARTED', 'AUTO_FIX_COMPLETED', 'AUTO_FIX_FAILED']
          },
        },
      }),
      prisma.activityEvent.findMany({
        where: {
          userId,
          ...projectFilter,
          ...dateFilter,
          eventType: {
            in: ['APR_PR_CREATED', 'APR_COMPLETED']
          },
        },
      }),
      prisma.activityEvent.findMany({
        where: {
          userId,
          ...projectFilter,
          ...dateFilter,
          eventType: 'TEST_GENERATION',
        },
      }),
    ]);

    const totalFixes = aiFixes.length;
    const successfulFixes = aiFixes.filter((a) => a.status === 'COMPLETED').length;
    const successRate = totalFixes > 0 ? ((successfulFixes / totalFixes) * 100).toFixed(1) : '0';
    const totalPRs = aiPRs.length;
    const totalTests = testGeneration.reduce((acc: number, activity) => {
      const metadata = activity.metadata as ActivityMetadata;
      return acc + (metadata?.testsGenerated || 0);
    }, 0);

    const avgTimePerFix = 30;
    const avgTimePerPR = 45;
    const avgTimePerTest = 15;
    const timeSaved = 
      (successfulFixes * avgTimePerFix) +
      (totalPRs * avgTimePerPR) +
      (totalTests * avgTimePerTest);

    const formatDuration = (minutes: number): string => {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    // Send to Slack
    const slackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🤖 AI Productivity Report',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Total Fixes:*\n${totalFixes}`,
            },
            {
              type: 'mrkdwn',
              text: `*Success Rate:*\n${successRate}%`,
            },
            {
              type: 'mrkdwn',
              text: `*PRs Created:*\n${totalPRs}`,
            },
            {
              type: 'mrkdwn',
              text: `*Tests Generated:*\n${totalTests}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*⏱️ Time Saved:* ${formatDuration(timeSaved)}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Generated by CodeMind • ${new Date().toLocaleString()}`,
            },
          ],
        },
      ],
    };

    const slackResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    });

    if (!slackResponse.ok) {
      throw new Error('Failed to send to Slack');
    }

    return NextResponse.json({
      success: true,
      message: 'Report sent to Slack successfully',
    });

  } catch (error) {
    console.error('Error sending to Slack:', error);
    return NextResponse.json(
      { error: 'Failed to send to Slack' },
      { status: 500 }
    );
  }
}
