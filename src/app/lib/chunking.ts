import { logger } from './logger';

// Enhanced type definitions for code chunking
export interface CodeChunk {
  path: string;
  content: string;
  startLine: number;
  endLine: number;
  language?: string;
  tokenCount?: number;
}

export interface ChunkingOptions {
  maxLines?: number;
  maxTokens?: number;
  overlapLines?: number;
  preserveFunctions?: boolean;
  minChunkSize?: number;
}

export interface ChunkingResult {
  chunks: CodeChunk[];
  totalLines: number;
  totalChunks: number;
  avgChunkSize: number;
}

/**
 * Enhanced code file chunking with intelligent splitting and overlap
 */
export function chunkCodeFile(
  content: string,
  path: string,
  options: ChunkingOptions = {}
): ChunkingResult {
  const {
    maxLines = 200,
    maxTokens = 1000,
    overlapLines = 20,
    preserveFunctions = true,
    minChunkSize = 10
  } = options;

  const lines = content.split("\n");
  const chunks: CodeChunk[] = [];
  const detectedLanguage = detectLanguage(path);
  
  logger.debug('Starting file chunking', {
    path,
    language: detectedLanguage,
    totalLines: lines.length,
    maxLines,
    maxTokens,
  });

  let start = 0;
  
  while (start < lines.length) {
    const end = findOptimalChunkEnd(
      lines, 
      start, 
      maxLines, 
      detectedLanguage, 
      preserveFunctions
    );
    
    // Skip chunks that are too small
    if (end - start < minChunkSize) {
      start = end;
      continue;
    }
    
    const chunkLines = lines.slice(start, end);
    const chunkContent = chunkLines.join("\n");
    const tokenCount = estimateTokenCount(chunkContent);
    
    // If chunk exceeds token limit, split it further
    if (tokenCount > maxTokens) {
      const subChunks = splitByTokenLimit(chunkLines, start, maxTokens, path, detectedLanguage);
      chunks.push(...subChunks);
    } else {
      chunks.push({
        path,
        content: chunkContent,
        startLine: start + 1,
        endLine: end,
        language: detectedLanguage,
        tokenCount,
      });
    }
    
    // Move start position with overlap
    start = Math.max(end - overlapLines, start + 1);
  }

  const result: ChunkingResult = {
    chunks,
    totalLines: lines.length,
    totalChunks: chunks.length,
    avgChunkSize: chunks.length > 0 ? 
      chunks.reduce((sum, chunk) => sum + (chunk.endLine - chunk.startLine), 0) / chunks.length : 
      0,
  };

  logger.debug('File chunking completed', {
    path,
    language: detectedLanguage,
    ...result,
  });

  return result;
}

/**
 * Detect programming language from file extension
 */
function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'kt': 'kotlin',
    'swift': 'swift',
    'scala': 'scala',
    'sh': 'bash',
    'sql': 'sql',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'md': 'markdown',
  };
  
  return languageMap[ext] || 'text';
}

/**
 * Find optimal chunk end position considering language constructs
 */
function findOptimalChunkEnd(
  lines: string[],
  start: number,
  maxLines: number,
  language: string,
  preserveFunctions: boolean
): number {
  const maxEnd = Math.min(start + maxLines, lines.length);
  
  if (!preserveFunctions) {
    return maxEnd;
  }
  
  // Language-specific function/class boundary detection
  const patterns = getFunctionPatterns(language);
  
  // Look for natural breaking points (function/class boundaries)
  for (let i = maxEnd - 1; i > start + Math.floor(maxLines * 0.7); i--) {
    const line = lines[i]?.trim() || '';
    
    // Check if this line ends a function/class
    if (patterns.some(pattern => pattern.test(line))) {
      return i + 1;
    }
    
    // Check for blank lines as natural boundaries
    if (line === '' && i > start + Math.floor(maxLines * 0.5)) {
      return i;
    }
  }
  
  return maxEnd;
}

/**
 * Get function/class patterns for different languages
 */
function getFunctionPatterns(language: string): RegExp[] {
  const patterns: Record<string, RegExp[]> = {
    javascript: [/^\s*}\s*$/, /^\s*};\s*$/, /^\s*},?\s*$/, /^\s*}\)\s*$/],
    typescript: [/^\s*}\s*$/, /^\s*};\s*$/, /^\s*},?\s*$/, /^\s*}\)\s*$/],
    python: [/^\s*def\s+\w+/, /^\s*class\s+\w+/, /^\s*async\s+def\s+\w+/],
    java: [/^\s*}\s*$/, /^\s*public\s+class/, /^\s*private\s+class/, /^\s*protected\s+class/],
    cpp: [/^\s*}\s*$/, /^\s*};\s*$/, /^\s*namespace/, /^\s*class/],
    c: [/^\s*}\s*$/, /^\s*};\s*$/, /^\s*struct/, /^\s*typedef/],
  };
  
  return patterns[language] || [/^\s*}\s*$/];
}

/**
 * Split chunk by token limit when it's too large
 */
function splitByTokenLimit(
  lines: string[],
  startLine: number,
  maxTokens: number,
  path: string,
  language: string
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let currentStart = 0;
  let currentTokens = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const lineTokens = estimateTokenCount(lines[i]);
    
    if (currentTokens + lineTokens > maxTokens && i > currentStart) {
      // Create chunk from currentStart to i
      const chunkLines = lines.slice(currentStart, i);
      chunks.push({
        path,
        content: chunkLines.join("\n"),
        startLine: startLine + currentStart + 1,
        endLine: startLine + i,
        language,
        tokenCount: currentTokens,
      });
      
      currentStart = i;
      currentTokens = lineTokens;
    } else {
      currentTokens += lineTokens;
    }
  }
  
  // Add remaining lines as final chunk
  if (currentStart < lines.length) {
    const chunkLines = lines.slice(currentStart);
    chunks.push({
      path,
      content: chunkLines.join("\n"),
      startLine: startLine + currentStart + 1,
      endLine: startLine + lines.length,
      language,
      tokenCount: currentTokens,
    });
  }
  
  return chunks;
}

/**
 * Estimate token count for a text (rough approximation)
 */
function estimateTokenCount(text: string): number {
  // Simple heuristic: ~4.5 characters per token for code
  return Math.ceil(text.length / 4.5);
}

/**
 * Batch process multiple files with chunking
 */
export async function chunkMultipleFiles(
  files: { path: string; content: string }[],
  options: ChunkingOptions = {}
): Promise<{
  results: Record<string, ChunkingResult>;
  totalChunks: number;
  processingTime: number;
}> {
  const startTime = Date.now();
  const results: Record<string, ChunkingResult> = {};
  let totalChunks = 0;
  
  logger.info('Starting batch file chunking', {
    fileCount: files.length,
    options,
  });
  
  for (const file of files) {
    const result = chunkCodeFile(file.content, file.path, options);
    results[file.path] = result;
    totalChunks += result.totalChunks;
  }
  
  const processingTime = Date.now() - startTime;
  
  logger.info('Batch file chunking completed', {
    fileCount: files.length,
    totalChunks,
    processingTime,
  });
  
  return {
    results,
    totalChunks,
    processingTime,
  };
}
