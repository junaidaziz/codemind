import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get counts in parallel
    const [projectCount, workspaceCount, messageCount, aprCount, recentActivity] = await Promise.all([
      // Count individual projects
      prisma.project.count({ 
        where: { ownerId: user.id } 
      }),
      // Count workspaces (multi-repo feature)
      prisma.workspace.count({ 
        where: { userId: user.id } 
      }),
      prisma.message.count({ 
        where: { 
          ChatSession: { userId: user.id } 
        } 
      }),
      prisma.autoFixSession.count({ 
        where: { userId: user.id } 
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
      }),
    ]);

    // Get total repositories across all workspaces
    const workspaces = await prisma.workspace.findMany({
      where: { userId: user.id },
      select: { repositories: true }
    });
    
    const totalReposInWorkspaces = workspaces.reduce((sum, workspace) => {
      const repos = Array.isArray(workspace.repositories) ? workspace.repositories : [];
      return sum + repos.length;
    }, 0);

    return NextResponse.json({
      projects: projectCount,
      workspaces: workspaceCount,
      repositories: totalReposInWorkspaces,
      messages: messageCount,
      aprSessions: aprCount,
      recentActivity,
    });

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
