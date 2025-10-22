import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Dashboard Stats] Fetching stats for user:', user.id);

    // First, let's check if there are any chat sessions for this user
    const chatSessions = await prisma.chatSession.findMany({
      where: { userId: user.id },
      select: { id: true, messageCount: true, projectId: true }
    });
    console.log('[Dashboard Stats] Chat sessions found:', chatSessions.length);
    console.log('[Dashboard Stats] Chat sessions:', JSON.stringify(chatSessions, null, 2));

    // Check if the projects referenced by chat sessions exist
    if (chatSessions.length > 0) {
      const projectIds = [...new Set(chatSessions.map(s => s.projectId))];
      const existingProjects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true }
      });
      console.log('[Dashboard Stats] Projects referenced by sessions:', projectIds.length);
      console.log('[Dashboard Stats] Projects that exist:', existingProjects.length);
      console.log('[Dashboard Stats] Existing projects:', JSON.stringify(existingProjects, null, 2));
    }

    // Get counts in parallel with detailed logging
    const [projectCount, workspaceCount, messageCount, aprCount, recentActivity] = await Promise.all([
      // Count individual projects
      prisma.project.count({ 
        where: { ownerId: user.id } 
      }).then(count => {
        console.log('[Dashboard Stats] Project count:', count);
        return count;
      }),
      // Count workspaces (multi-repo feature)
      prisma.workspace.count({ 
        where: { userId: user.id } 
      }).then(count => {
        console.log('[Dashboard Stats] Workspace count:', count);
        return count;
      }),
      // Count messages - try two different approaches
      prisma.message.count({ 
        where: { 
          ChatSession: { 
            userId: user.id 
          } 
        } 
      }).then(async (count) => {
        console.log('[Dashboard Stats] Message count (via relation):', count);
        
        // Also try counting via session IDs
        const sessionIds = chatSessions.map(s => s.id);
        const altCount = await prisma.message.count({
          where: {
            sessionId: { in: sessionIds }
          }
        });
        console.log('[Dashboard Stats] Message count (via session IDs):', altCount);
        
        return altCount || count; // Use whichever is non-zero
      }),
      prisma.autoFixSession.count({ 
        where: { userId: user.id } 
      }).then(count => {
        console.log('[Dashboard Stats] APR session count:', count);
        return count;
      }),
      prisma.activityEvent.findMany({
        where: { userId: user.id },
        include: {
          project: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }).then(activities => {
        console.log('[Dashboard Stats] Recent activities count:', activities.length);
        return activities;
      }),
    ]);

    // Get total repositories across all workspaces
    const workspaces = await prisma.workspace.findMany({
      where: { userId: user.id },
      select: { repositories: true }
    });
    
    console.log('[Dashboard Stats] Workspaces with repos:', workspaces.length);
    
    const totalReposInWorkspaces = workspaces.reduce((sum, workspace) => {
      const repos = Array.isArray(workspace.repositories) ? workspace.repositories : [];
      return sum + repos.length;
    }, 0);

    console.log('[Dashboard Stats] Total repos in workspaces:', totalReposInWorkspaces);

    const stats = {
      projects: projectCount,
      workspaces: workspaceCount,
      repositories: totalReposInWorkspaces,
      messages: messageCount,
      aprSessions: aprCount,
      recentActivity,
    };

    console.log('[Dashboard Stats] Final stats:', JSON.stringify(stats, null, 2));

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
