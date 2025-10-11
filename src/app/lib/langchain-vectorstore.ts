import { VectorStore } from '@langchain/core/vectorstores';
import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { retrieveRelevantChunks, RelevantChunk } from './db-utils';
import { embedTexts } from './embeddings';
import { env } from '../../types/env';
import { logger } from './logger';

interface FilterOptions {
  minSimilarity?: number;
  languages?: string[];
  paths?: string[];
}



/**
 * Custom LangChain VectorStore implementation for our pgvector database
 */
export class CodeMindVectorStore extends VectorStore {
  private projectId: string;
  _vectorstoreType(): string {
    return 'codemind';
  }

  constructor(embeddings: Embeddings, projectId: string) {
    super(embeddings, {});
    this.projectId = projectId;
  }

  /**
   * Required method for VectorStore - not used in our implementation
   * as we manage embeddings externally through our chunking process
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addDocuments(_documents: Document[]): Promise<string[]> {
    throw new Error('addDocuments not implemented - use the indexing pipeline instead');
  }

  /**
   * Required method for VectorStore - not used in our implementation
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addVectors(_vectors: number[][], _documents: Document[]): Promise<string[]> {
    throw new Error('addVectors not implemented - use the indexing pipeline instead');
  }

  /**
   * Required method for VectorStore - not used in our implementation
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async delete(_params?: { ids?: string[] }): Promise<void> {
    throw new Error('delete not implemented - use the indexing pipeline instead');
  }

  /**
   * Main method for similarity search - integrates with our existing retrieval system
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: FilterOptions
  ): Promise<[Document, number][]> {
    logger.debug('Performing similarity search', {
      projectId: this.projectId,
      k,
      queryLength: query.length,
      filter,
    });

    try {
      // Use our existing retrieval function
      const chunks = await retrieveRelevantChunks(this.projectId, query, {
        limit: k,
        minSimilarity: filter?.minSimilarity || 0.1,
        languages: filter?.languages,
        paths: filter?.paths,
      });

      // Convert chunks to LangChain Documents
      const results: [Document, number][] = chunks.map((chunk: RelevantChunk) => {
        const document = new Document({
          pageContent: chunk.content,
          metadata: {
            id: chunk.id,
            path: chunk.path,
            language: chunk.language,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            projectId: this.projectId,
          },
        });

        return [document, chunk.similarity];
      });

      logger.debug('Similarity search completed', {
        projectId: this.projectId,
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error('Similarity search failed', { projectId: this.projectId }, error as Error);
      throw error;
    }
  }

  /**
   * Static method to create a CodeMindVectorStore instance
   */
  static async fromProjectId(projectId: string): Promise<CodeMindVectorStore> {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });

    return new CodeMindVectorStore(embeddings, projectId);
  }


}

/**
 * Custom Embeddings class that uses our existing embedding function
 */
export class CodeMindEmbeddings extends Embeddings {
  async embedDocuments(texts: string[]): Promise<number[][]> {
    logger.debug('Embedding documents', { count: texts.length });
    
    try {
      const embeddings = await embedTexts(texts);
      logger.debug('Documents embedded successfully', { count: embeddings.length });
      return embeddings;
    } catch (error) {
      logger.error('Failed to embed documents', {}, error as Error);
      throw error;
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    logger.debug('Embedding query', { textLength: text.length });
    
    try {
      const [embedding] = await embedTexts([text]);
      logger.debug('Query embedded successfully');
      return embedding;
    } catch (error) {
      logger.error('Failed to embed query', {}, error as Error);
      throw error;
    }
  }
}