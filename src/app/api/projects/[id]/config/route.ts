import { NextRequest, NextResponse } from 'next/server';
import prisma from "../../../../lib/db";
// TODO: Add authentication when auth system is configured
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '../../../../../auth/[...nextauth]/route';

interface ConfigParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: ConfigParams) {
  const { id } = await params;
  try {
    // TODO: Add authentication when auth system is configured
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Verify project exists and user has access (TODO: Add user access verification when auth is configured)
    const project = await prisma.project.findFirst({
      where: {
        id: id
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get project configuration
    const config = await prisma.projectConfig.findFirst({
      where: {
        projectId: id
      }
    });

    if (!config) {
      return NextResponse.json({ 
        projectId: id,
        message: 'No configuration found. Create one using POST.' 
      }, { status: 404 });
    }

    // Return config with sensitive fields masked
    const maskedConfig = {
      id: config.id,
      projectId: config.projectId,
      vercelToken: config.vercelToken ? maskSensitiveValue(config.vercelToken) : null,
      vercelProjectId: config.vercelProjectId,
      vercelTeamId: config.vercelTeamId,
      openaiApiKey: config.openaiApiKey ? maskSensitiveValue(config.openaiApiKey) : null,
      githubAppId: config.githubAppId,
      githubPrivateKey: config.githubPrivateKey ? maskSensitiveValue(config.githubPrivateKey) : null,
      githubInstallationId: config.githubInstallationId,
      githubWebhookSecret: config.githubWebhookSecret ? maskSensitiveValue(config.githubWebhookSecret) : null,
      githubToken: config.githubToken ? maskSensitiveValue(config.githubToken) : null,
      isEncrypted: config.isEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };

    return NextResponse.json(maskedConfig);

  } catch (error) {
    console.error('Project config GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project configuration' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: ConfigParams) {
  const { id } = await params;
  try {
    // TODO: Add authentication when auth system is configured
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Verify project exists and user has access (TODO: Add user access verification when auth is configured)
    const project = await prisma.project.findFirst({
      where: {
        id: id
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      vercelToken,
      vercelProjectId,
      vercelTeamId,
      openaiApiKey,
      githubAppId,
      githubPrivateKey,
      githubInstallationId,
      githubWebhookSecret,
      githubToken
    } = body;

    // Check if config already exists
    const existingConfig = await prisma.projectConfig.findFirst({
      where: {
        projectId: id
      }
    });

    if (existingConfig) {
      return NextResponse.json({ 
        error: 'Configuration already exists. Use PUT to update.' 
      }, { status: 409 });
    }

    // Create new configuration
    // TODO: Implement encryption for sensitive fields
    const config = await prisma.projectConfig.create({
      data: {
        projectId: id,
        vercelToken: vercelToken || null,
        vercelProjectId: vercelProjectId || null,
        vercelTeamId: vercelTeamId || null,
        openaiApiKey: openaiApiKey || null,
        githubAppId: githubAppId || null,
        githubPrivateKey: githubPrivateKey || null,
        githubInstallationId: githubInstallationId || null,
        githubWebhookSecret: githubWebhookSecret || null,
        githubToken: githubToken || null,
        isEncrypted: false, // TODO: Set to true when encryption is implemented
      }
    });

    // Return created config with sensitive fields masked
    const maskedConfig = {
      id: config.id,
      projectId: config.projectId,
      vercelToken: config.vercelToken ? maskSensitiveValue(config.vercelToken) : null,
      vercelProjectId: config.vercelProjectId,
      vercelTeamId: config.vercelTeamId,
      openaiApiKey: config.openaiApiKey ? maskSensitiveValue(config.openaiApiKey) : null,
      githubAppId: config.githubAppId,
      githubPrivateKey: config.githubPrivateKey ? maskSensitiveValue(config.githubPrivateKey) : null,
      githubInstallationId: config.githubInstallationId,
      githubWebhookSecret: config.githubWebhookSecret ? maskSensitiveValue(config.githubWebhookSecret) : null,
      githubToken: config.githubToken ? maskSensitiveValue(config.githubToken) : null,
      isEncrypted: config.isEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };

    return NextResponse.json(maskedConfig, { status: 201 });

  } catch (error) {
    console.error('Project config POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create project configuration' }, 
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: ConfigParams) {
  const { id } = await params;
  try {
    // TODO: Add authentication when auth system is configured
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Verify project exists and user has access (TODO: Add user access verification when auth is configured)
    const project = await prisma.project.findFirst({
      where: {
        id: id
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      vercelToken,
      vercelProjectId,
      vercelTeamId,
      openaiApiKey,
      githubAppId,
      githubPrivateKey,
      githubInstallationId,
      githubWebhookSecret,
      githubToken
    } = body;

    // Update existing configuration or create if doesn't exist
    // TODO: Implement encryption for sensitive fields
    const config = await prisma.projectConfig.upsert({
      where: {
        projectId: id
      },
      create: {
        projectId: id,
        vercelToken: vercelToken || null,
        vercelProjectId: vercelProjectId || null,
        vercelTeamId: vercelTeamId || null,
        openaiApiKey: openaiApiKey || null,
        githubAppId: githubAppId || null,
        githubPrivateKey: githubPrivateKey || null,
        githubInstallationId: githubInstallationId || null,
        githubWebhookSecret: githubWebhookSecret || null,
        githubToken: githubToken || null,
        isEncrypted: false, // TODO: Set to true when encryption is implemented
      },
      update: {
        vercelToken: vercelToken || null,
        vercelProjectId: vercelProjectId || null,
        vercelTeamId: vercelTeamId || null,
        openaiApiKey: openaiApiKey || null,
        githubAppId: githubAppId || null,
        githubPrivateKey: githubPrivateKey || null,
        githubInstallationId: githubInstallationId || null,
        githubWebhookSecret: githubWebhookSecret || null,
        githubToken: githubToken || null,
        updatedAt: new Date(),
      }
    });

    // Return updated config with sensitive fields masked
    const maskedConfig = {
      id: config.id,
      projectId: config.projectId,
      vercelToken: config.vercelToken ? maskSensitiveValue(config.vercelToken) : null,
      vercelProjectId: config.vercelProjectId,
      vercelTeamId: config.vercelTeamId,
      openaiApiKey: config.openaiApiKey ? maskSensitiveValue(config.openaiApiKey) : null,
      githubAppId: config.githubAppId,
      githubPrivateKey: config.githubPrivateKey ? maskSensitiveValue(config.githubPrivateKey) : null,
      githubInstallationId: config.githubInstallationId,
      githubWebhookSecret: config.githubWebhookSecret ? maskSensitiveValue(config.githubWebhookSecret) : null,
      githubToken: config.githubToken ? maskSensitiveValue(config.githubToken) : null,
      isEncrypted: config.isEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };

    return NextResponse.json(maskedConfig);

  } catch (error) {
    console.error('Project config PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update project configuration' }, 
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: ConfigParams) {
  const { id } = await params;
  try {
    // TODO: Add authentication when auth system is configured
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Verify project exists and user has access (TODO: Add user access verification when auth is configured)
    const project = await prisma.project.findFirst({
      where: {
        id: id
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if config exists
    const existingConfig = await prisma.projectConfig.findFirst({
      where: {
        projectId: id
      }
    });

    if (!existingConfig) {
      return NextResponse.json({ 
        error: 'Configuration not found' 
      }, { status: 404 });
    }

    // Delete configuration
    await prisma.projectConfig.delete({
      where: {
        projectId: id
      }
    });

    return NextResponse.json({ 
      message: 'Project configuration deleted successfully' 
    });

  } catch (error) {
    console.error('Project config DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project configuration' }, 
      { status: 500 }
    );
  }
}

// Helper function to mask sensitive values
function maskSensitiveValue(value: string): string {
  if (!value || value.length < 8) {
    return '••••••••';
  }
  
  const firstTwo = value.slice(0, 2);
  const lastTwo = value.slice(-2);
  const middle = '•'.repeat(Math.max(4, value.length - 4));
  
  return `${firstTwo}${middle}${lastTwo}`;
}