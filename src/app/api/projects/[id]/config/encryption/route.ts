import { NextRequest, NextResponse } from 'next/server';
import { ConfigEncryption, EncryptedProjectConfigService } from '@/lib/config-encryption';
import { ENCRYPTED_FIELDS } from '@/lib/project-config-service';
import { logger } from '@/lib/logger';
import prisma from '@/lib/db';

// Define ProjectConfig type based on what we know exists
interface ProjectConfig {
  id: string;
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
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface EncryptionParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/projects/[id]/config/encryption - Manage configuration encryption
export async function POST(request: NextRequest, { params }: EncryptionParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findFirst({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    switch (action) {
      case 'test': {
        // Test encryption functionality
        const testResult = ConfigEncryption.test();
        
        if (testResult.success) {
          logger.info('Encryption test successful', { projectId });
          return NextResponse.json({
            success: true,
            message: 'Encryption is working correctly',
            result: testResult
          });
        } else {
          logger.error('Encryption test failed', { projectId, error: testResult.error });
          return NextResponse.json({
            success: false,
            message: 'Encryption test failed',
            error: testResult.error
          }, { status: 500 });
        }
      }

      case 'migrate': {
        // Migrate existing configuration to encrypted format
        const migrationResult = await EncryptedProjectConfigService.migrateToEncryption(projectId);
        
        if (migrationResult.success) {
          logger.info('Configuration migration successful', { projectId });
          return NextResponse.json({
            success: true,
            message: migrationResult.message,
            projectId
          });
        } else {
          logger.error('Configuration migration failed', { projectId });
          return NextResponse.json({
            success: false,
            message: migrationResult.message,
            projectId
          }, { status: 500 });
        }
      }

      case 'encrypt': {
        // Encrypt a specific value (for testing or manual operations)
        const { value } = body;
        
        if (!value) {
          return NextResponse.json({
            error: 'Value to encrypt is required'
          }, { status: 400 });
        }

        try {
          const encrypted = ConfigEncryption.encrypt(value);
          
          logger.info('Value encrypted successfully', { 
            projectId,
            originalLength: value.length,
            encryptedLength: encrypted.length
          });

          return NextResponse.json({
            success: true,
            encrypted,
            isEncrypted: ConfigEncryption.isEncrypted(encrypted),
            message: 'Value encrypted successfully'
          });
          
        } catch (error) {
          logger.error('Encryption failed', { projectId, error });
          return NextResponse.json({
            success: false,
            error: 'Failed to encrypt value',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      case 'decrypt': {
        // Decrypt a specific value (for testing or manual operations)
        const { encryptedValue } = body;
        
        if (!encryptedValue) {
          return NextResponse.json({
            error: 'Encrypted value is required'
          }, { status: 400 });
        }

        try {
          const decrypted = ConfigEncryption.decrypt(encryptedValue);
          
          logger.info('Value decrypted successfully', { 
            projectId,
            encryptedLength: encryptedValue.length,
            decryptedLength: decrypted.length
          });

          return NextResponse.json({
            success: true,
            decrypted,
            message: 'Value decrypted successfully'
          });
          
        } catch (error) {
          logger.error('Decryption failed', { projectId, error });
          return NextResponse.json({
            success: false,
            error: 'Failed to decrypt value',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: test, migrate, encrypt, decrypt',
          supportedActions: ['test', 'migrate', 'encrypt', 'decrypt']
        }, { status: 400 });
    }

  } catch (error) {
    logger.error('Error in encryption management API', {
      projectId: (await params).id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to manage encryption',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/config/encryption - Get encryption status
export async function GET(request: NextRequest, { params }: EncryptionParams) {
  try {
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findFirst({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get project configuration  
    const config: ProjectConfig | null = await (prisma as unknown as { projectConfig: { findUnique: (args: { where: { projectId: string } }) => Promise<ProjectConfig | null> } }).projectConfig.findUnique({
      where: { projectId }
    });
    
    // Test encryption functionality
    const encryptionTest = ConfigEncryption.test();

    // Check which fields would be encrypted
    const encryptedFields = Array.from(ENCRYPTED_FIELDS);

    const status = {
      projectId,
      hasConfig: !!config,
      isEncrypted: config?.isEncrypted ?? false,
      encryptionWorking: encryptionTest.success,
      encryptionError: encryptionTest.error,
      
      encryptedFields,
      
      fieldStatus: config ? {
        vercelToken: {
          hasValue: !!config.vercelToken,
          shouldEncrypt: ENCRYPTED_FIELDS.has('vercelToken'),
          appearsEncrypted: config.vercelToken ? ConfigEncryption.isEncrypted(config.vercelToken) : false
        },
        openaiApiKey: {
          hasValue: !!config.openaiApiKey,
          shouldEncrypt: ENCRYPTED_FIELDS.has('openaiApiKey'),
          appearsEncrypted: config.openaiApiKey ? ConfigEncryption.isEncrypted(config.openaiApiKey) : false
        },
        githubPrivateKey: {
          hasValue: !!config.githubPrivateKey,
          shouldEncrypt: ENCRYPTED_FIELDS.has('githubPrivateKey'),
          appearsEncrypted: config.githubPrivateKey ? ConfigEncryption.isEncrypted(config.githubPrivateKey) : false
        },
        githubWebhookSecret: {
          hasValue: !!config.githubWebhookSecret,
          shouldEncrypt: ENCRYPTED_FIELDS.has('githubWebhookSecret'),
          appearsEncrypted: config.githubWebhookSecret ? ConfigEncryption.isEncrypted(config.githubWebhookSecret) : false
        },
        githubToken: {
          hasValue: !!config.githubToken,
          shouldEncrypt: ENCRYPTED_FIELDS.has('githubToken'),
          appearsEncrypted: config.githubToken ? ConfigEncryption.isEncrypted(config.githubToken) : false
        }
      } : null,

      recommendations: [] as string[]
    };

    // Generate recommendations
    if (!encryptionTest.success) {
      status.recommendations.push('Fix encryption configuration - encryption is not working');
    }

    if (config && !config.isEncrypted) {
      const hasUnencryptedSensitiveData = Array.from(ENCRYPTED_FIELDS).some(field => {
        const value = config[field as keyof typeof config] as string;
        return value && !ConfigEncryption.isEncrypted(value);
      });

      if (hasUnencryptedSensitiveData) {
        status.recommendations.push('Migrate configuration to encrypted format for better security');
      }
    }

    logger.info('Encryption status retrieved', {
      projectId,
      hasConfig: status.hasConfig,
      isEncrypted: status.isEncrypted,
      encryptionWorking: status.encryptionWorking
    });

    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error retrieving encryption status', {
      projectId: (await params).id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve encryption status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}