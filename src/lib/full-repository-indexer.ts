// Full Repository Indexing Service
import prisma from '../app/lib/db';
import { logger } from '../app/lib/logger';
import { FileType } from './repository-scanner';
import { githubTreeService, GitHubTreeItem } from './github-tree';
import { chunkCodeFile } from '../app/lib/chunking';
import { embedTexts } from '../app/lib/embeddings';

export interface FullIndexOptions {
  forceReindex?: boolean;
  includeContent?: boolean;
  maxConcurrentFiles?: number;
  chunkAndEmbed?: boolean;
}

export interface IndexingStats {
  totalFiles: number;
  newFiles: number;
  updatedFiles: number;
  deletedFiles: number;
  skippedFiles: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  processingTime: number;
  errors: Array<{
    file: string;
    error: string;
  }>;
}

/**
 * Service for full repository indexing and synchronization
 */
export class FullRepositoryIndexer {
  constructor(
    private projectId: string,
    private githubUrl: string,
    private options: FullIndexOptions = {}
  ) {}

  /**
   * Perform full repository indexing
   */
  async indexRepository(): Promise<IndexingStats> {
    const startTime = Date.now();
    const stats: IndexingStats = {
      totalFiles: 0,
      newFiles: 0,
      updatedFiles: 0,
      deletedFiles: 0,
      skippedFiles: 0,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      processingTime: 0,
      errors: [],
    };

    try {
      logger.info('Starting full repository indexing', {
        projectId: this.projectId,
        githubUrl: this.githubUrl,
        options: this.options,
      });

      // Step 1: Get repository structure from GitHub
      const repoInfo = githubTreeService.parseGitHubUrl(this.githubUrl);
      const tree = await githubTreeService.getRepositoryTree(
        repoInfo.owner,
        repoInfo.repo,
        undefined,
        true
      );

      // Step 2: Filter to supported files
      const supportedFiles = githubTreeService.filterSupportedFiles(tree.tree);
      stats.totalFiles = supportedFiles.length;

      logger.info('Repository tree analyzed', {
        projectId: this.projectId,
        totalTreeItems: tree.tree.length,
        supportedFiles: supportedFiles.length,
      });

      // Step 3: Get existing files from database
      const existingFiles = await this.getExistingProjectFiles();
      const existingFileMap = new Map(
        existingFiles.map(f => [f.relativePath, {
          id: f.id,
          relativePath: f.relativePath,
          gitSha: f.gitSha ?? undefined,
          isIndexed: f.isIndexed,
        }])
      );

      // Step 4: Process each file
      await this.processFilesInBatches(
        supportedFiles,
        existingFileMap,
        repoInfo,
        stats
      );

      // Step 5: Remove files that no longer exist in repository
      await this.removeDeletedFiles(supportedFiles, existingFiles, stats);

      // Step 6: Update project metadata
      await this.updateProjectMetadata();

      stats.processingTime = Date.now() - startTime;

      logger.info('Full repository indexing completed', {
        projectId: this.projectId,
        stats,
      });

      return stats;

    } catch (error) {
      logger.error('Full repository indexing failed', {
        projectId: this.projectId,
      }, error as Error);
      
      stats.processingTime = Date.now() - startTime;
      stats.errors.push({
        file: 'repository_root',
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Get existing project files from database
   */
  private async getExistingProjectFiles() {
    return await prisma.projectFile.findMany({
      where: { projectId: this.projectId },
    });
  }

  /**
   * Process files in batches to avoid overwhelming the system
   */
  private async processFilesInBatches(
    supportedFiles: GitHubTreeItem[],
    existingFileMap: Map<string, { id: string; relativePath: string; gitSha?: string; isIndexed: boolean }>,
    repoInfo: { owner: string; repo: string },
    stats: IndexingStats
  ) {
    const batchSize = this.options.maxConcurrentFiles ?? 10;
    
    for (let i = 0; i < supportedFiles.length; i += batchSize) {
      const batch = supportedFiles.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (file) => {
          try {
            await this.processFile(file, existingFileMap.get(file.path), repoInfo, stats);
          } catch (error) {
            logger.error('Failed to process file', {
              projectId: this.projectId,
              file: file.path,
            }, error as Error);
            
            stats.errors.push({
              file: file.path,
              error: (error as Error).message,
            });
          }
        })
      );

      // Log progress
      logger.info('Batch processed', {
        projectId: this.projectId,
        processed: Math.min(i + batchSize, supportedFiles.length),
        total: supportedFiles.length,
        progress: Math.round((Math.min(i + batchSize, supportedFiles.length) / supportedFiles.length) * 100),
      });
    }
  }

  /**
   * Process individual file
   */
  private async processFile(
    treeItem: GitHubTreeItem,
    existingFile: { id: string; relativePath: string; gitSha?: string; isIndexed: boolean } | undefined,
    repoInfo: { owner: string; repo: string },
    stats: IndexingStats
  ) {
    const shouldUpdate = this.shouldUpdateFile(treeItem, existingFile);
    
    if (!shouldUpdate && !this.options.forceReindex) {
      stats.skippedFiles++;
      return;
    }

    // Determine file metadata
    const extension = this.getFileExtension(treeItem.path);
    const fileType = this.determineFileType(treeItem.path, extension);
    const language = this.determineLanguage(extension);

    let content: string | undefined;
    let actualSha = treeItem.sha;
    let actualSize = treeItem.size ?? 0;

    // Fetch content if needed
    if (this.options.includeContent || this.options.chunkAndEmbed) {
      try {
        const fileContent = await githubTreeService.getFileContent(
          repoInfo.owner,
          repoInfo.repo,
          treeItem.path
        );
        content = fileContent.content;
        actualSha = fileContent.sha;
        actualSize = fileContent.size;
      } catch (error) {
        logger.warn('Failed to fetch file content', {
          projectId: this.projectId,
          file: treeItem.path,
        }, error as Error);
      }
    }

    // Count lines
    const lines = content ? content.split('\n').length : 0;

    // Upsert project file
    const projectFile = await prisma.projectFile.upsert({
      where: {
        projectId_relativePath: {
          projectId: this.projectId,
          relativePath: treeItem.path,
        },
      },
      update: {
        fileType,
        language,
        extension,
        size: actualSize,
        lines,
        lastModified: new Date(), // GitHub doesn't provide file mtime in tree API
        gitSha: actualSha,
        isIndexed: existingFile?.isIndexed ?? false,
      },
      create: {
        projectId: this.projectId,
        relativePath: treeItem.path,
        fileType,
        language,
        extension,
        size: actualSize,
        lines,
        lastModified: new Date(),
        gitSha: actualSha,
        isIndexed: false,
      },
    });

    if (existingFile) {
      stats.updatedFiles++;
    } else {
      stats.newFiles++;
    }

    // Chunk and embed if requested
    if (this.options.chunkAndEmbed && content && this.shouldChunkFile(fileType, actualSize)) {
      try {
        await this.chunkAndEmbedFile(projectFile.id, treeItem.path, content, language, stats);
        
        // Mark file as indexed
        await prisma.projectFile.update({
          where: { id: projectFile.id },
          data: { isIndexed: true },
        });
      } catch (error) {
        logger.error('Failed to chunk and embed file', {
          projectId: this.projectId,
          file: treeItem.path,
        }, error as Error);
        
        stats.errors.push({
          file: treeItem.path,
          error: `Chunking failed: ${(error as Error).message}`,
        });
      }
    }
  }

  /**
   * Determine if file should be updated
   */
  private shouldUpdateFile(treeItem: GitHubTreeItem, existingFile: { gitSha?: string } | undefined): boolean {
    if (!existingFile) {
      return true; // New file
    }

    if (this.options.forceReindex) {
      return true; // Force update
    }

    // Check if SHA changed
    return existingFile.gitSha !== treeItem.sha;
  }

  /**
   * Chunk and embed file content
   */
  private async chunkAndEmbedFile(
    projectFileId: string,
    filePath: string,
    content: string,
    language: string,
    stats: IndexingStats
  ) {
    // Delete existing chunks for this file
    await prisma.codeChunk.deleteMany({
      where: { 
        projectId: this.projectId,
        path: filePath,
      },
    });

    // Create new chunks
    const chunkingResult = chunkCodeFile(content, filePath, {
      maxLines: 200,
      maxTokens: 1000,
      preserveFunctions: true,
    });
    
    for (const chunk of chunkingResult.chunks) {
      // Generate a simple SHA for the chunk
      const crypto = await import('crypto');
      const chunkSha = crypto.createHash('sha256').update(chunk.content).digest('hex').substring(0, 40);

      const codeChunk = await prisma.codeChunk.create({
        data: {
          projectId: this.projectId,
          path: filePath,
          sha: chunkSha,
          language,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          content: chunk.content,
          tokenCount: chunk.tokenCount ?? 0,
        },
      });

      stats.chunksCreated++;

      // Generate embedding
      try {
        const embeddings = await embedTexts([chunk.content]);
        if (embeddings && embeddings.length > 0) {
          await prisma.codeChunk.update({
            where: { id: codeChunk.id },
            data: { embedding: JSON.stringify(embeddings[0]) },
          });
          stats.embeddingsGenerated++;
        }
      } catch (error) {
        logger.warn('Failed to generate embedding for chunk', {
          projectId: this.projectId,
          chunkId: codeChunk.id,
        }, error as Error);
      }
    }
  }

  /**
   * Remove files that no longer exist in repository
   */
  private async removeDeletedFiles(
    supportedFiles: GitHubTreeItem[],
    existingFiles: Array<{ id: string; relativePath: string }>,
    stats: IndexingStats
  ) {
    const currentFilePaths = new Set(supportedFiles.map(f => f.path));
    const filesToDelete = existingFiles.filter(f => !currentFilePaths.has(f.relativePath));

    for (const file of filesToDelete) {
      // Delete associated chunks first
      await prisma.codeChunk.deleteMany({
        where: { 
          projectId: this.projectId,
          path: file.relativePath,
        },
      });

      // Delete project file
      await prisma.projectFile.delete({
        where: { id: file.id },
      });

      stats.deletedFiles++;
    }

    if (filesToDelete.length > 0) {
      logger.info('Deleted removed files', {
        projectId: this.projectId,
        deletedCount: filesToDelete.length,
      });
    }
  }

  /**
   * Update project metadata
   */
  private async updateProjectMetadata() {
    await prisma.project.update({
      where: { id: this.projectId },
      data: {
        lastIndexedAt: new Date(),
        status: 'indexed',
      },
    });
  }

  /**
   * Utility methods
   */
  private getFileExtension(path: string): string {
    return path.substring(path.lastIndexOf('.'));
  }

  private determineFileType(path: string, extension: string): string {
    const fileName = path.split('/').pop() ?? '';
    
    // Test files
    if (fileName.includes('.test.') || fileName.includes('.spec.') || path.includes('__tests__')) {
      return FileType.TEST;
    }

    // Config files
    if (fileName.match(/^(config|.*\.config|.*\.conf)\.(js|ts|json)$/) || 
        ['package.json', 'tsconfig.json'].includes(fileName)) {
      return FileType.CONFIG;
    }

    // React components
    if (extension === '.tsx' || extension === '.jsx') {
      return FileType.REACT_COMPONENT;
    }

    // Language-specific
    switch (extension) {
      case '.ts': return FileType.TYPESCRIPT;
      case '.js': return FileType.JAVASCRIPT;
      case '.json': return FileType.JSON;
      case '.md': return FileType.MARKDOWN;
      case '.css': case '.scss': return FileType.STYLESHEET;
      default: return FileType.OTHER;
    }
  }

  private determineLanguage(extension: string): string {
    switch (extension) {
      case '.ts': case '.tsx': return 'typescript';
      case '.js': case '.jsx': return 'javascript';
      case '.json': return 'json';
      case '.md': return 'markdown';
      case '.css': return 'css';
      case '.scss': return 'scss';
      default: return 'text';
    }
  }

  private shouldChunkFile(fileType: string, size: number): boolean {
    // Don't chunk very large files or certain file types
    const maxChunkSize = 500 * 1024; // 500KB
    if (size > maxChunkSize) return false;

    // Only chunk code files
    return [
      FileType.TYPESCRIPT,
      FileType.JAVASCRIPT,
      FileType.REACT_COMPONENT,
    ].includes(fileType as FileType);
  }
}

/**
 * Main function to perform full repository indexing
 */
export async function performFullRepositoryIndex(
  projectId: string,
  options: FullIndexOptions = {}
): Promise<IndexingStats> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const indexer = new FullRepositoryIndexer(projectId, project.githubUrl, options);
  return await indexer.indexRepository();
}