// Repository Scanner - Comprehensive file discovery and analysis
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../app/lib/logger';

export interface ScannedFile {
  relativePath: string;
  absolutePath: string;
  size: number;
  extension: string;
  type: FileType;
  lastModified: Date;
  content?: string;
  lines: number;
  language: string;
}

export enum FileType {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  REACT_COMPONENT = 'react_component',
  JSON = 'json',
  MARKDOWN = 'markdown',
  CONFIG = 'config',
  TEST = 'test',
  DECLARATION = 'declaration',
  STYLESHEET = 'stylesheet',
  OTHER = 'other',
}

export interface ScanOptions {
  includeContent?: boolean;
  maxFileSize?: number; // in bytes
  extensions?: string[];
  excludePatterns?: string[];
  includePatterns?: string[];
  followSymlinks?: boolean;
}

const DEFAULT_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', 
  '.json', '.md', '.css', '.scss',
  '.yaml', '.yml', '.env'
];

const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.nyc_output',
  'out',
  '.vercel',
  '.cache',
];

/**
 * Comprehensive repository scanner that analyzes all code files
 */
export class RepositoryScanner {
  private options: Required<ScanOptions>;

  constructor(options: ScanOptions = {}) {
    this.options = {
      includeContent: options.includeContent ?? true,
      maxFileSize: options.maxFileSize ?? 1024 * 1024, // 1MB default
      extensions: options.extensions ?? DEFAULT_EXTENSIONS,
      excludePatterns: options.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS,
      includePatterns: options.includePatterns ?? [],
      followSymlinks: options.followSymlinks ?? false,
    };
  }

  /**
   * Scan repository and return all discovered files
   */
  async scanRepository(rootDir: string): Promise<ScannedFile[]> {
    const startTime = Date.now();
    const files: ScannedFile[] = [];
    
    logger.info('Starting repository scan', {
      rootDir,
      options: this.options,
    });

    try {
      await this.walkDirectory(rootDir, rootDir, files);
      
      const scanDuration = Date.now() - startTime;
      logger.info('Repository scan completed', {
        totalFiles: files.length,
        duration: scanDuration,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        fileTypes: this.getFileTypeStats(files),
      });

      return files;
    } catch (error) {
      logger.error('Repository scan failed', { rootDir }, error as Error);
      throw error;
    }
  }

  /**
   * Recursively walk directory structure
   */
  private async walkDirectory(
    currentDir: string, 
    rootDir: string, 
    files: ScannedFile[]
  ): Promise<void> {
    try {
      const items = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        const relativePath = path.relative(rootDir, fullPath);

        // Check exclude patterns
        if (this.shouldExclude(relativePath, item.name)) {
          continue;
        }

        // Handle directories
        if (item.isDirectory()) {
          await this.walkDirectory(fullPath, rootDir, files);
          continue;
        }

        // Handle symlinks
        if (item.isSymbolicLink() && this.options.followSymlinks) {
          try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.isDirectory()) {
              await this.walkDirectory(fullPath, rootDir, files);
            } else if (stat.isFile()) {
              await this.processFile(fullPath, relativePath, files);
            }
          } catch (error) {
            logger.warn('Failed to process symlink', { fullPath }, error as Error);
          }
          continue;
        }

        // Handle regular files
        if (item.isFile()) {
          await this.processFile(fullPath, relativePath, files);
        }
      }
    } catch (error) {
      logger.error('Failed to read directory', { currentDir }, error as Error);
    }
  }

  /**
   * Process individual file
   */
  private async processFile(
    absolutePath: string, 
    relativePath: string, 
    files: ScannedFile[]
  ): Promise<void> {
    try {
      const extension = path.extname(absolutePath).toLowerCase();
      
      // Check if file extension is supported
      if (!this.options.extensions.includes(extension)) {
        return;
      }

      // Check include patterns if specified
      if (this.options.includePatterns.length > 0) {
        const matches = this.options.includePatterns.some(pattern =>
          relativePath.includes(pattern) || path.basename(absolutePath).includes(pattern)
        );
        if (!matches) {
          return;
        }
      }

      const stat = await fs.promises.stat(absolutePath);
      
      // Skip files that are too large
      if (stat.size > this.options.maxFileSize) {
        logger.warn('Skipping large file', {
          file: relativePath,
          size: stat.size,
          maxSize: this.options.maxFileSize,
        });
        return;
      }

      let content: string | undefined;
      let lines = 0;

      // Read file content if requested
      if (this.options.includeContent) {
        try {
          content = await fs.promises.readFile(absolutePath, 'utf-8');
          lines = content.split('\n').length;
        } catch (error) {
          logger.warn('Failed to read file content', { file: relativePath }, error as Error);
          content = undefined;
        }
      }

      const scannedFile: ScannedFile = {
        relativePath,
        absolutePath,
        size: stat.size,
        extension,
        type: this.determineFileType(relativePath, extension, content),
        lastModified: stat.mtime,
        content,
        lines,
        language: this.determineLanguage(extension, relativePath),
      };

      files.push(scannedFile);

    } catch (error) {
      logger.error('Failed to process file', { file: relativePath }, error as Error);
    }
  }

  /**
   * Determine if file/directory should be excluded
   */
  private shouldExclude(relativePath: string, itemName: string): boolean {
    // Check against exclude patterns
    for (const pattern of this.options.excludePatterns) {
      if (
        relativePath.includes(pattern) ||
        itemName === pattern ||
        itemName.startsWith(pattern)
      ) {
        return true;
      }
    }

    // Exclude hidden files/directories (starting with .)
    if (itemName.startsWith('.') && !itemName.match(/\.(ts|js|json|md|env)$/)) {
      return true;
    }

    return false;
  }

  /**
   * Determine file type based on extension and content
   */
  private determineFileType(relativePath: string, extension: string, content?: string): FileType {
    const fileName = path.basename(relativePath);
    const dirPath = path.dirname(relativePath);

    // Test files
    if (
      fileName.includes('.test.') || 
      fileName.includes('.spec.') || 
      dirPath.includes('__tests__') ||
      dirPath.includes('tests')
    ) {
      return FileType.TEST;
    }

    // Type declarations
    if (fileName.endsWith('.d.ts')) {
      return FileType.DECLARATION;
    }

    // Config files
    if (
      fileName.match(/^(config|.*\.config|.*\.conf)\.(js|ts|json)$/) ||
      ['package.json', 'tsconfig.json', 'jest.config.js', 'next.config.ts'].includes(fileName)
    ) {
      return FileType.CONFIG;
    }

    // React components
    if (extension === '.tsx' || (extension === '.jsx')) {
      return FileType.REACT_COMPONENT;
    }

    // Check content for React components in .ts/.js files
    if ((extension === '.ts' || extension === '.js') && content) {
      if (content.includes('React') || content.includes('jsx') || content.includes('JSX')) {
        return FileType.REACT_COMPONENT;
      }
    }

    // Stylesheets
    if (['.css', '.scss', '.sass', '.less'].includes(extension)) {
      return FileType.STYLESHEET;
    }

    // Language-specific
    switch (extension) {
      case '.ts':
        return FileType.TYPESCRIPT;
      case '.js':
        return FileType.JAVASCRIPT;
      case '.json':
        return FileType.JSON;
      case '.md':
        return FileType.MARKDOWN;
      default:
        return FileType.OTHER;
    }
  }

  /**
   * Determine programming language
   */
  private determineLanguage(extension: string, relativePath: string): string {
    switch (extension) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.json':
        return 'json';
      case '.md':
        return 'markdown';
      case '.css':
        return 'css';
      case '.scss':
        return 'scss';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.env':
        return 'dotenv';
      default:
        return 'text';
    }
  }

  /**
   * Get file type statistics
   */
  private getFileTypeStats(files: ScannedFile[]): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const file of files) {
      const type = file.type;
      stats[type] = (stats[type] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Filter files by criteria
   */
  static filterFiles(
    files: ScannedFile[], 
    criteria: {
      fileTypes?: FileType[];
      languages?: string[];
      minSize?: number;
      maxSize?: number;
      modifiedAfter?: Date;
    }
  ): ScannedFile[] {
    return files.filter(file => {
      if (criteria.fileTypes && !criteria.fileTypes.includes(file.type)) {
        return false;
      }

      if (criteria.languages && !criteria.languages.includes(file.language)) {
        return false;
      }

      if (criteria.minSize && file.size < criteria.minSize) {
        return false;
      }

      if (criteria.maxSize && file.size > criteria.maxSize) {
        return false;
      }

      if (criteria.modifiedAfter && file.lastModified < criteria.modifiedAfter) {
        return false;
      }

      return true;
    });
  }
}

/**
 * Simplified function for basic repository scanning
 */
export async function scanRepository(rootDir: string): Promise<string[]> {
  const scanner = new RepositoryScanner({
    includeContent: false,
    extensions: DEFAULT_EXTENSIONS,
  });

  const files = await scanner.scanRepository(rootDir);
  return files.map(f => f.relativePath);
}

export default RepositoryScanner;