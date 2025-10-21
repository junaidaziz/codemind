import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface TasksParams {
  params: Promise<{
    id: string;
  }>;
}

export interface UnifiedTask {
  id: string;
  title: string;
  description: string;
  status: string;
  source: 'github' | 'jira' | 'trello';
  url: string;
  labels: string[];
  assignees: string[];
  priority?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  type?: string;
}

/**
 * GET /api/projects/[id]/tasks
 * Fetch all tasks from GitHub, Jira, and Trello for a project
 */
export async function GET(request: NextRequest, { params }: TasksParams) {
  const { id } = await params;
  
  try {
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        ProjectConfig: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const config = project.ProjectConfig; // eslint-disable-line @typescript-eslint/no-unused-vars
    const allTasks: UnifiedTask[] = [];

    // Fetch GitHub Issues
    try {
      const githubIssues = await prisma.issue.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      const githubTasks: UnifiedTask[] = githubIssues.map(issue => ({
        id: `github-${issue.id}`,
        title: issue.title,
        description: issue.body || '',
        status: issue.state.toLowerCase(),
        source: 'github' as const,
        url: issue.htmlUrl,
        labels: issue.labels || [],
        assignees: issue.assignees || [],
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        author: issue.authorLogin,
        type: 'issue'
      }));

      allTasks.push(...githubTasks);
    } catch (error) {
      console.error('Error fetching GitHub issues:', error);
    }

    // Fetch Jira Issues (requires database migration)
    // TODO: Uncomment after running: pnpm prisma migrate dev
    /*
    if (config?.jiraApiToken && config?.jiraEmail && config?.jiraDomain) {
      try {
        const auth = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
        const jqlQuery = `project = ${config.jiraProjectKey || ''} ORDER BY updated DESC`;
        
        const response = await fetch(
          `https://${config.jiraDomain}/rest/api/3/search?jql=${encodeURIComponent(jqlQuery)}&maxResults=100`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          const jiraTasks: UnifiedTask[] = data.issues.map((issue: Record<string, unknown>) => ({
            id: `jira-${issue.id}`,
            title: issue.fields.summary,
            description: issue.fields.description || '',
            status: issue.fields.status.name.toLowerCase(),
            source: 'jira' as const,
            url: `https://${config.jiraDomain}/browse/${issue.key}`,
            labels: issue.fields.labels || [],
            assignees: issue.fields.assignee ? [issue.fields.assignee.displayName] : [],
            priority: issue.fields.priority?.name,
            dueDate: issue.fields.duedate,
            createdAt: issue.fields.created,
            updatedAt: issue.fields.updated,
            author: issue.fields.reporter?.displayName,
            type: issue.fields.issuetype.name
          }));

          allTasks.push(...jiraTasks);
        }
      } catch (error) {
        console.error('Error fetching Jira issues:', error);
      }
    }
    */

    // Fetch Trello Cards (requires database migration)
    // TODO: Uncomment after running: pnpm prisma migrate dev
    /*
    if (config?.trelloApiKey && config?.trelloToken && config?.trelloBoardId) {
      try {
        const auth = `key=${config.trelloApiKey}&token=${config.trelloToken}`;
        const response = await fetch(
          `https://api.trello.com/1/boards/${config.trelloBoardId}/cards?${auth}&fields=all`
        );

        if (response.ok) {
          const cards = await response.json();
          
          // Get lists for status mapping
          const listsResponse = await fetch(
            `https://api.trello.com/1/boards/${config.trelloBoardId}/lists?${auth}`
          );
          const lists = await listsResponse.json();
          const listMap = lists.reduce((acc: Record<string, string>, list: Record<string, unknown>) => {
            acc[list.id as string] = list.name as string;
            return acc;
          }, {});

          const trelloTasks: UnifiedTask[] = cards.map((card: Record<string, unknown>) => ({
            id: `trello-${card.id}`,
            title: card.name,
            description: card.desc || '',
            status: listMap[card.idList as string]?.toLowerCase() || 'unknown',
            source: 'trello' as const,
            url: card.url,
            labels: card.labels?.map((l: Record<string, unknown>) => l.name) || [],
            assignees: [], // Trello member names would need additional API calls
            dueDate: card.due,
            createdAt: card.dateLastActivity,
            updatedAt: card.dateLastActivity,
            type: 'card'
          }));

          allTasks.push(...trelloTasks);
        }
      } catch (error) {
        console.error('Error fetching Trello cards:', error);
      }
    }
    */

    // Sort by most recently updated
    allTasks.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      data: allTasks,
      count: allTasks.length,
      sources: {
        github: allTasks.filter(t => t.source === 'github').length,
        jira: allTasks.filter(t => t.source === 'jira').length,
        trello: allTasks.filter(t => t.source === 'trello').length
      }
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tasks', 
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
