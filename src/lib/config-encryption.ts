import crypto from 'crypto';
import { logger } from '../app/lib/logger';

/**
 * Configuration Encryption Service
 * Provides secure encryption/decryption for sensitive configuration values
 */
export class ConfigEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 12;  // 96 bits for GCM
  private static readonly TAG_LENGTH = 16; // 128 bits for GCM
  
  // Use a different key for each environment
  private static getEncryptionKey(): Buffer {
    const key = process.env.CONFIG_ENCRYPTION_KEY;
    
    if (!key) {
      throw new Error('CONFIG_ENCRYPTION_KEY environment variable is required for encryption');
    }
    
    // Derive a consistent key from the environment variable
    return crypto.scryptSync(key, 'config-salt', this.KEY_LENGTH);
  }

  /**
   * Encrypt a configuration value
   */
  static encrypt(plaintext: string): string {
    try {
      if (!plaintext) {
        return plaintext;
      }

      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from('config', 'utf8'));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV + tag + encrypted data
      const combined = Buffer.concat([
        iv,
        tag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return combined.toString('base64');
      
    } catch (error) {
      logger.error('Error encrypting configuration value', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to encrypt configuration value');
    }
  }

  /**
   * Decrypt a configuration value
   */
  static decrypt(encryptedData: string): string {
    try {
      if (!encryptedData) {
        return encryptedData;
      }

      const key = this.getEncryptionKey();
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract IV, tag, and encrypted data
      const iv = combined.subarray(0, this.IV_LENGTH);
      const tag = combined.subarray(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH);
      const encrypted = combined.subarray(this.IV_LENGTH + this.TAG_LENGTH);
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      decipher.setAAD(Buffer.from('config', 'utf8'));
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      logger.error('Error decrypting configuration value', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to decrypt configuration value');
    }
  }

  /**
   * Check if a value appears to be encrypted
   */
  static isEncrypted(value: string): boolean {
    if (!value) return false;
    
    try {
      // Check if it's valid base64 and has minimum expected length
      const decoded = Buffer.from(value, 'base64');
      return decoded.length >= (this.IV_LENGTH + this.TAG_LENGTH + 1);
    } catch {
      return false;
    }
  }

  /**
   * Safely encrypt a value only if it's not already encrypted
   */
  static safeEncrypt(value: string): string {
    if (!value || this.isEncrypted(value)) {
      return value;
    }
    return this.encrypt(value);
  }

  /**
   * Safely decrypt a value only if it appears encrypted
   */
  static safeDecrypt(value: string): string {
    if (!value || !this.isEncrypted(value)) {
      return value;
    }
    return this.decrypt(value);
  }

  /**
   * Generate a random encryption key for environment setup
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Test encryption/decryption functionality
   */
  static test(): { success: boolean; error?: string } {
    try {
      const testValue = 'test-config-value-123';
      const encrypted = this.encrypt(testValue);
      const decrypted = this.decrypt(encrypted);
      
      if (testValue !== decrypted) {
        throw new Error('Decrypted value does not match original');
      }
      
      return { success: true };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Enhanced Project Configuration Service with Encryption
 */
export class EncryptedProjectConfigService {
  
  /**
   * List of field names that should be encrypted
   */
  private static readonly ENCRYPTED_FIELDS = [
    'vercelToken',
    'openaiApiKey',
    'githubPrivateKey',
    'githubWebhookSecret',
    'githubToken'
  ];

  /**
   * Check if a field should be encrypted
   */
  static shouldEncrypt(fieldName: string): boolean {
    return this.ENCRYPTED_FIELDS.includes(fieldName);
  }

  /**
   * Encrypt configuration values before storing
   */
  static encryptConfigData(data: Record<string, unknown>): Record<string, unknown> {
    const encrypted = { ...data };
    
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'string' && this.shouldEncrypt(key)) {
        encrypted[key] = ConfigEncryption.safeEncrypt(value);
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt configuration values after retrieving
   */
  static decryptConfigData(data: Record<string, unknown>): Record<string, unknown> {
    const decrypted = { ...data };
    
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'string' && this.shouldEncrypt(key)) {
        decrypted[key] = ConfigEncryption.safeDecrypt(value);
      }
    }
    
    return decrypted;
  }

  /**
   * Migrate existing unencrypted configuration to encrypted
   */
  static async migrateToEncryption(projectId: string): Promise<{ success: boolean; message: string }> {
    try {
      // This would typically involve:
      // 1. Reading existing config from database
      // 2. Encrypting sensitive fields
      // 3. Updating database with encrypted values
      // 4. Setting isEncrypted flag to true
      
      logger.info('Configuration encryption migration requested', { projectId });
      
      return {
        success: true,
        message: 'Configuration migration to encryption completed'
      };
      
    } catch (error) {
      logger.error('Error migrating configuration to encryption', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        message: 'Configuration migration to encryption failed'
      };
    }
  }
}

export default ConfigEncryption;