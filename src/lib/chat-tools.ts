/**
 * Chat Tools - AI-callable functions for project management
 * These tools can be invoked by the AI during chat conversations
 */

import { Octokit } from '@octokit/rest';
import prisma from '@/lib/db';
import { getGitHubToken } from './config-helper';

export interface ToolParams {
  [key: string]: string | undefined;
}

export interface ToolResult {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

export interface ChatTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  execute: (params: ToolParams, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  projectId: string;
  userId: string;
  sessionId: string;
}

/**
 * Tool: Create GitHub Issue
 */
export const createGitHubIssueTool: ChatTool = {
  name: 'create_github_issue',
  description: 'Create a new issue on GitHub repository. Use this when user wants to create an issue, bug report, or feature request.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The title of the issue'
      },
      body: {
        type: 'string',
        description: 'The detailed description of the issue (supports Markdown)'
      },
      labels: {
        type: 'string',
        description: 'Comma-separated labels (e.g., "bug,priority:high")'
      },
      assignees: {
        type: 'string',
        description: 'Comma-separated GitHub usernames to assign (optional)'
      }
    },
    required: ['title', 'body']
  },
  execute: async (params, context) => {
    const { title, body, labels, assignees } = params;
    
    // Validate required parameters
    if (!title || !body) {
      throw new Error('Title and body are required');
    }
    
    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: context.projectId }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Parse GitHub URL
    const match = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL');
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    // Get GitHub token
    const token = await getGitHubToken(context.projectId);
    if (!token) {
      throw new Error('GitHub token not configured. Please add it in project settings.');
    }

    const octokit = new Octokit({ auth: token });

    // Create the issue
    const issueData: {
      owner: string;
      repo: string;
      title: string;
      body: string;
      labels?: string[];
      assignees?: string[];
    } = {
      owner,
      repo: cleanRepo,
      title,
      body
    };

    // Add labels if provided
    if (labels) {
      issueData.labels = labels.split(',').map((l: string) => l.trim());
    }

    // Add assignees if provided
    if (assignees) {
      issueData.assignees = assignees.split(',').map((a: string) => a.trim());
    }

    const { data: issue } = await octokit.rest.issues.create(issueData);

    // Store in database
    await prisma.issue.create({
      data: {
        projectId: context.projectId,
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state === 'open' ? 'OPEN' : 'CLOSED',
        htmlUrl: issue.html_url,
        authorLogin: issue.user?.login || 'unknown',
        authorUrl: issue.user?.html_url || '',
        labels: issue.labels?.map((label) => 
          typeof label === 'string' ? label : (label.name ?? '')
        ).filter((name): name is string => name !== '') || [],
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at)
      }
    });

    return {
      success: true,
      issue: {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        labels: issue.labels?.map((l) => typeof l === 'string' ? l : l.name) || []
      },
      message: `Successfully created issue #${issue.number}: ${issue.title}`
    };
  }
};

/**
 * Tool: Assign GitHub Issue
 */
export const assignGitHubIssueTool: ChatTool = {
  name: 'assign_github_issue',
  description: 'Assign a GitHub issue to one or more contributors. Use this when user wants to assign an issue to someone.',
  parameters: {
    type: 'object',
    properties: {
      issueNumber: {
        type: 'string',
        description: 'The issue number (e.g., "42")'
      },
      assignees: {
        type: 'string',
        description: 'Comma-separated GitHub usernames to assign (e.g., "username1,username2")'
      }
    },
    required: ['issueNumber', 'assignees']
  },
  execute: async (params, context) => {
    const { issueNumber, assignees } = params;
    
    // Validate required parameters
    if (!issueNumber || !assignees) {
      throw new Error('Issue number and assignees are required');
    }
    
    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: context.projectId }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Parse GitHub URL
    const match = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL');
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    // Get GitHub token
    const token = await getGitHubToken(context.projectId);
    if (!token) {
      throw new Error('GitHub token not configured. Please add it in project settings.');
    }

    const octokit = new Octokit({ auth: token });

    // Assign the issue
    const assigneesList = assignees.split(',').map((a: string) => a.trim());
    
    const { data: issue } = await octokit.rest.issues.addAssignees({
      owner,
      repo: cleanRepo,
      issue_number: parseInt(issueNumber),
      assignees: assigneesList
    });

    // Update in database
    await prisma.issue.updateMany({
      where: {
        projectId: context.projectId,
        number: parseInt(issueNumber)
      },
      data: {
        assignees: issue.assignees?.map(a => a.login) || [],
        updatedAt: new Date()
      }
    });

    return {
      success: true,
      issue: {
        number: issue.number,
        title: issue.title,
        assignees: issue.assignees?.map(a => a.login) || [],
        url: issue.html_url
      },
      message: `Successfully assigned issue #${issue.number} to ${assigneesList.join(', ')}`
    };
  }
};

/**
 * Tool: List GitHub Issues
 */
export const listGitHubIssuesTool: ChatTool = {
  name: 'list_github_issues',
  description: 'List issues from the GitHub repository. Use this to show open/closed issues, filter by labels, or search for specific issues.',
  parameters: {
    type: 'object',
    properties: {
      state: {
        type: 'string',
        description: 'Filter by state',
        enum: ['open', 'closed', 'all']
      },
      labels: {
        type: 'string',
        description: 'Filter by labels (comma-separated)'
      },
      limit: {
        type: 'string',
        description: 'Maximum number of issues to return (default: 10)'
      }
    },
    required: []
  },
  execute: async (params, context) => {
    const { state = 'open', labels, limit = '10' } = params;
    
    const issues = await prisma.issue.findMany({
      where: {
        projectId: context.projectId,
        ...(state !== 'all' && { 
          state: state === 'open' ? 'OPEN' : 'CLOSED' 
        }),
        ...(labels && {
          labels: {
            hasSome: labels.split(',').map((l: string) => l.trim())
          }
        })
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    return {
      success: true,
      issues: issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels,
        assignees: issue.assignees,
        author: issue.authorLogin,
        url: issue.htmlUrl,
        createdAt: issue.createdAt
      })),
      count: issues.length,
      message: `Found ${issues.length} issue(s)`
    };
  }
};

/**
 * Tool: Fetch Jira Issues
 * NOTE: Commented out until Prisma schema migration is complete
 */
/*
export const fetchJiraIssuesTool: ChatTool = {
  name: 'fetch_jira_issues',
  description: 'Fetch issues from Jira. Use this to sync or display Jira issues in CodeMind.',
  parameters: {
    type: 'object',
    properties: {
      jql: {
        type: 'string',
        description: 'JQL query to filter issues (optional, defaults to project issues)'
      }
    },
    required: []
  },
  execute: async (params, context) => {
    const { jql } = params;
    
    // Get Jira config from project settings
    const config = await prisma.projectConfig.findUnique({
      where: { projectId: context.projectId }
    });

    if (!config?.jiraApiToken || !config?.jiraEmail || !config?.jiraDomain) {
      throw new Error('Jira credentials not configured. Please add them in project settings.');
    }

    const auth = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
    
    const jqlQuery = jql || `project = ${config.jiraProjectKey || ''}`;
    
    const response = await fetch(
      `https://${config.jiraDomain}/rest/api/3/search?jql=${encodeURIComponent(jqlQuery)}&maxResults=50`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      issues: Array<{
        key: string;
        fields: {
          summary: string;
          status: { name: string };
          assignee?: { displayName: string };
          priority?: { name: string };
          issuetype: { name: string };
        };
      }>;
    };

    return {
      success: true,
      issues: data.issues.map((issue) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        priority: issue.fields.priority?.name || 'None',
        type: issue.fields.issuetype.name,
        url: `https://${config.jiraDomain}/browse/${issue.key}`
      })),
      count: data.issues.length,
      message: `Fetched ${data.issues.length} issue(s) from Jira`
    };
  }
};
*/

/**
 * Tool: Fetch Trello Cards
 * NOTE: Commented out until Prisma schema migration is complete
 */
/*
export const fetchTrelloCardsTool: ChatTool = {
  name: 'fetch_trello_cards',
  description: 'Fetch cards from Trello board. Use this to sync or display Trello tasks in CodeMind.',
  parameters: {
    type: 'object',
    properties: {
      listName: {
        type: 'string',
        description: 'Filter by list name (optional, e.g., "To Do", "In Progress")'
      }
    },
    required: []
  },
  execute: async (params, context) => {
    const { listName } = params;
    
    // Get Trello config from project settings
    const config = await prisma.projectConfig.findUnique({
      where: { projectId: context.projectId }
    });

    if (!config?.trelloApiKey || !config?.trelloToken || !config?.trelloBoardId) {
      throw new Error('Trello credentials not configured. Please add them in project settings.');
    }

    const baseUrl = `https://api.trello.com/1/boards/${config.trelloBoardId}`;
    const auth = `key=${config.trelloApiKey}&token=${config.trelloToken}`;

    // Get all cards from the board
    const response = await fetch(`${baseUrl}/cards?${auth}`);
    
    if (!response.ok) {
      throw new Error(`Trello API error: ${response.statusText}`);
    }

    interface TrelloCard {
      id: string;
      name: string;
      desc: string;
      url: string;
      due: string | null;
      idList: string;
      labels: Array<{ name: string }>;
      idMembers: string[];
    }

    interface TrelloList {
      id: string;
      name: string;
    }

    let cards = await response.json() as TrelloCard[];

    // Filter by list if specified
    if (listName) {
      const listsResponse = await fetch(`${baseUrl}/lists?${auth}`);
      const lists = await listsResponse.json() as TrelloList[];
      const targetList = lists.find((l) => 
        l.name.toLowerCase() === listName.toLowerCase()
      );
      
      if (targetList) {
        cards = cards.filter((c) => c.idList === targetList.id);
      }
    }

    return {
      success: true,
      cards: cards.map((card) => ({
        id: card.id,
        name: card.name,
        description: card.desc,
        url: card.url,
        due: card.due,
        labels: card.labels.map((l) => l.name),
        members: card.idMembers.length
      })),
      count: cards.length,
      message: `Fetched ${cards.length} card(s) from Trello`
    };
  }
};
*/

/**
 * Registry of all available chat tools
 */
export const chatTools: ChatTool[] = [
  createGitHubIssueTool,
  assignGitHubIssueTool,
  listGitHubIssuesTool,
  // fetchJiraIssuesTool,  // Commented out until DB migration complete
  // fetchTrelloCardsTool  // Commented out until DB migration complete
];

/**
 * Get tool by name
 */
export function getTool(name: string): ChatTool | undefined {
  return chatTools.find(tool => tool.name === name);
}

/**
 * Execute a tool with given parameters
 */
export async function executeTool(
  toolName: string,
  params: ToolParams,
  context: ToolContext
): Promise<ToolResult> {
  const tool = getTool(toolName);
  
  if (!tool) {
    throw new Error(`Tool '${toolName}' not found`);
  }

  try {
    return await tool.execute(params, context);
  } catch (error) {
    console.error(`Error executing tool '${toolName}':`, error);
    throw error;
  }
}
