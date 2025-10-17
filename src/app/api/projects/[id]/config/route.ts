import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { 
  getUserProjectRole, 
  // hasPermission,  // Currently unused
  FieldMasker, 
  getConfigAccessLevel,
  logConfigAccess 
} from '@/lib/rbac';
import { getUserId } from '@/lib/auth-server';

// Custom ProjectConfig interface to match actual usage
interface ProjectConfig {
  id: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  // Configuration fields accessed in the code
  vercelToken: string | null;
  vercelProjectId: string | null;
  vercelTeamId: string | null;
  openaiApiKey: string | null;
  githubAppId: string | null;
  githubPrivateKey: string | null;
  githubInstallationId: string | null;
  githubWebhookSecret: string | null;
  githubToken: string | null;
  encryptionSalt: string | null;
  isEncrypted: boolean;
}

// Extend PrismaClient type to include projectConfig
type PrismaWithProjectConfig = typeof prisma & {
  projectConfig: {
    findFirst: (args?: {
      where?: { projectId?: string; id?: string };
      select?: Record<string, boolean>;
    }) => Promise<ProjectConfig | null>;
    create: (args: {
      data: {
        projectId: string;
        vercelToken?: string | null;
        vercelProjectId?: string | null;
        vercelTeamId?: string | null;
        openaiApiKey?: string | null;
        githubAppId?: string | null;
        githubPrivateKey?: string | null;
        githubInstallationId?: string | null;
        githubWebhookSecret?: string | null;
        githubToken?: string | null;
        encryptionSalt?: string | null;
        isEncrypted?: boolean;
      };
    }) => Promise<ProjectConfig>;
    upsert: (args: {
      where: { projectId: string };
      update: {
        vercelToken?: string | null;
        vercelProjectId?: string | null;
        vercelTeamId?: string | null;
        openaiApiKey?: string | null;
        githubAppId?: string | null;
        githubPrivateKey?: string | null;
        githubInstallationId?: string | null;
        githubWebhookSecret?: string | null;
        githubToken?: string | null;
        encryptionSalt?: string | null;
        isEncrypted?: boolean;
        updatedAt?: Date;
      };
      create: {
        projectId: string;
        vercelToken?: string | null;
        vercelProjectId?: string | null;
        vercelTeamId?: string | null;
        openaiApiKey?: string | null;
        githubAppId?: string | null;
        githubPrivateKey?: string | null;
        githubInstallationId?: string | null;
        githubWebhookSecret?: string | null;
        githubToken?: string | null;
        encryptionSalt?: string | null;
        isEncrypted?: boolean;
      };
    }) => Promise<ProjectConfig>;
    delete: (args: { where: { id: string } }) => Promise<ProjectConfig>;
  };
};
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
    // Get authenticated user ID (with development fallback)
    const userId = await getUserId(request, id);
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check user permissions for this project
    const accessLevel = await getConfigAccessLevel(userId, id);
    
    if (!accessLevel.canRead) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify project exists
    const project = await prisma.project.findFirst({
      where: { id: id }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get project configuration
    const config = await (prisma as PrismaWithProjectConfig).projectConfig.findFirst({
      where: { projectId: id }
    });

    if (!config) {
      return NextResponse.json({ 
        projectId: id,
        message: 'No configuration found. Create one using POST.' 
      }, { status: 404 });
    }

    // Get user role for field masking
    const userRole = await getUserProjectRole(userId, id);

    // Apply field masking based on user role
    const responseConfig = {
      id: config.id,
      projectId: config.projectId,
      vercelToken: FieldMasker.maskField('vercelToken', config.vercelToken),
      vercelProjectId: config.vercelProjectId,
      vercelTeamId: config.vercelTeamId,
      openaiApiKey: FieldMasker.maskField('openaiApiKey', config.openaiApiKey),
      githubAppId: config.githubAppId,
      githubPrivateKey: FieldMasker.maskField('githubPrivateKey', config.githubPrivateKey),
      githubInstallationId: config.githubInstallationId,
      githubWebhookSecret: FieldMasker.maskField('githubWebhookSecret', config.githubWebhookSecret),
      githubToken: FieldMasker.maskField('githubToken', config.githubToken),
      isEncrypted: config.isEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };

    // Apply role-based masking
    const maskedConfig = FieldMasker.maskSensitiveFields(responseConfig, userRole);

    // Log access
    await logConfigAccess({
      userId,
      projectId: id,
      action: 'view',
      timestamp: new Date(),
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    });

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
    // Get authenticated user ID (with development fallback)
    const userId = await getUserId(request, id);
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check user permissions for creating config
    const accessLevel = await getConfigAccessLevel(userId, id);
    
    if (!accessLevel.canWrite) {
      return NextResponse.json({ error: 'Insufficient permissions to create configuration' }, { status: 403 });
    }

    // Verify project exists
    const project = await prisma.project.findFirst({
      where: { id: id }
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
    const existingConfig = await (prisma as PrismaWithProjectConfig).projectConfig.findFirst({
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
    const config = await (prisma as PrismaWithProjectConfig).projectConfig.create({
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
    // Get authenticated user ID (with development fallback)
    const userId = await getUserId(request, id);
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check user permissions for updating config
    const accessLevel = await getConfigAccessLevel(userId, id);
    
    if (!accessLevel.canWrite) {
      return NextResponse.json({ error: 'Insufficient permissions to update configuration' }, { status: 403 });
    }

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
    const config = await (prisma as PrismaWithProjectConfig).projectConfig.upsert({
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
    // Get authenticated user ID (with development fallback)
    const userId = await getUserId(request, id);
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check user permissions for deleting config
    const accessLevel = await getConfigAccessLevel(userId, id);
    
    if (!accessLevel.canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions to delete configuration' }, { status: 403 });
    }

    // Verify project exists
    const project = await prisma.project.findFirst({
      where: {
        id: id
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if config exists
    const existingConfig = await (prisma as PrismaWithProjectConfig).projectConfig.findFirst({
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
    await (prisma as PrismaWithProjectConfig).projectConfig.delete({
      where: {
        id: existingConfig.id
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