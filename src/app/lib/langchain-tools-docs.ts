import { Tool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from './logger';

// Input schemas for documentation lookup
export const DocumentationSearchInputSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  source: z.enum(['mdn', 'nodejs', 'react', 'nextjs', 'typescript', 'web', 'auto']).default('auto'),
  limit: z.number().min(1).max(10).default(5),
});

export const WebPageContentInputSchema = z.object({
  url: z.string().url('Valid URL is required'),
  maxLength: z.number().min(100).max(10000).default(2000),
});

// Response schemas
export const DocumentationResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
  content: z.string().optional(),
  source: z.string(),
  relevanceScore: z.number().optional(),
});

export type DocumentationSearchInput = z.infer<typeof DocumentationSearchInputSchema>;
export type WebPageContentInput = z.infer<typeof WebPageContentInputSchema>;
export type DocumentationResult = z.infer<typeof DocumentationResultSchema>;

/**
 * Documentation sources configuration
 */
const DOCUMENTATION_SOURCES = {
  mdn: {
    name: 'MDN Web Docs',
    searchUrl: 'https://developer.mozilla.org/api/v1/search',
    baseUrl: 'https://developer.mozilla.org',
  },
  nodejs: {
    name: 'Node.js Documentation',
    searchUrl: 'https://nodejs.org/api/',
    baseUrl: 'https://nodejs.org',
  },
  react: {
    name: 'React Documentation',
    searchUrl: 'https://react.dev/',
    baseUrl: 'https://react.dev',
  },
  nextjs: {
    name: 'Next.js Documentation',
    searchUrl: 'https://nextjs.org/docs/',
    baseUrl: 'https://nextjs.org',
  },
  typescript: {
    name: 'TypeScript Documentation',
    searchUrl: 'https://www.typescriptlang.org/docs/',
    baseUrl: 'https://www.typescriptlang.org',
  },
};

/**
 * Documentation API client
 */
class DocumentationAPIClient {
  private userAgent = 'CodeMind-Bot/1.0';

  async searchMDN(query: string, limit: number): Promise<DocumentationResult[]> {
    try {
      const searchUrl = `${DOCUMENTATION_SOURCES.mdn.searchUrl}?q=${encodeURIComponent(query)}&locale=en-US`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`MDN API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return (data.documents || []).slice(0, limit).map((doc: { title: string; mdn_url: string; summary?: string; excerpt?: string; score?: number }) => ({
        title: doc.title,
        url: `${DOCUMENTATION_SOURCES.mdn.baseUrl}${doc.mdn_url}`,
        description: doc.summary || doc.excerpt || '',
        content: this.cleanHtmlContent(doc.summary || ''),
        source: 'MDN Web Docs',
        relevanceScore: doc.score,
      }));

    } catch (error) {
      logger.error('Failed to search MDN documentation', { query }, error as Error);
      return [];
    }
  }

  async searchWeb(query: string, limit: number): Promise<DocumentationResult[]> {
    // For a production implementation, you would integrate with a search API
    // like Google Custom Search, Bing Search API, or Algolia
    // For now, we'll return curated results based on common documentation patterns
    
    const curatedSources = [
      {
        title: `${query} - Documentation`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query + ' documentation')}`,
        description: `Search results for ${query} documentation`,
        content: `General web search for ${query} documentation. Please check the search results for specific information.`,
        source: 'Web Search',
      },
    ];

    return curatedSources.slice(0, limit);
  }

  async getWebPageContent(input: WebPageContentInput): Promise<string> {
    try {
      const response = await fetch(input.url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const cleanContent = this.extractTextFromHtml(html);
      
      return cleanContent.substring(0, input.maxLength);

    } catch (error) {
      logger.error('Failed to fetch webpage content', { url: input.url }, error as Error);
      throw error;
    }
  }

  private cleanHtmlContent(html: string): string {
    // Remove HTML tags and decode entities
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTextFromHtml(html: string): string {
    // Simple HTML content extraction
    // In a production environment, you might want to use a proper HTML parser
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }
}

/**
 * LangChain Tool for searching documentation
 */
export class DocumentationSearchTool extends Tool {
  name = 'documentation_search';
  description = `Search for documentation and technical information.
  Input should be a JSON string with: {"query": "search_term", "source": "mdn|nodejs|react|nextjs|typescript|web|auto", "limit": 5}
  Use this tool to find official documentation, API references, and technical guides.`;

  private client: DocumentationAPIClient = new DocumentationAPIClient();

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const validatedInput = DocumentationSearchInputSchema.parse(parsedInput);
      
      let results: DocumentationResult[] = [];

      // Search based on source preference
      switch (validatedInput.source) {
        case 'mdn':
          results = await this.client.searchMDN(validatedInput.query, validatedInput.limit);
          break;
        case 'web':
          results = await this.client.searchWeb(validatedInput.query, validatedInput.limit);
          break;
        case 'auto':
        default:
          // Try MDN first for web-related queries, then fallback to web search
          if (this.isWebRelatedQuery(validatedInput.query)) {
            results = await this.client.searchMDN(validatedInput.query, validatedInput.limit);
          }
          
          if (results.length === 0) {
            results = await this.client.searchWeb(validatedInput.query, validatedInput.limit);
          }
          break;
      }

      return JSON.stringify({
        success: true,
        query: validatedInput.query,
        source: validatedInput.source,
        totalResults: results.length,
        results: results.map((result: typeof results[0]) => ({
          title: result.title,
          url: result.url,
          description: result.description,
          source: result.source,
          relevanceScore: result.relevanceScore,
        })),
      }, null, 2);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('DocumentationSearchTool execution failed', { input }, error as Error);
      
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }

  private isWebRelatedQuery(query: string): boolean {
    const webKeywords = [
      'html', 'css', 'javascript', 'dom', 'web api', 'browser', 'fetch', 'promise',
      'async', 'event', 'element', 'document', 'window', 'localstorage', 'sessionstorage',
      'websocket', 'webrtc', 'geolocation', 'notification', 'service worker', 'pwa'
    ];
    
    const lowerQuery = query.toLowerCase();
    return webKeywords.some(keyword => lowerQuery.includes(keyword));
  }
}

/**
 * LangChain Tool for fetching specific webpage content
 */
export class WebPageContentTool extends Tool {
  name = 'webpage_content';
  description = `Fetch and extract text content from a specific webpage.
  Input should be a JSON string with: {"url": "https://example.com/page", "maxLength": 2000}
  Use this tool to read content from documentation pages, blog posts, or articles.`;

  private client: DocumentationAPIClient = new DocumentationAPIClient();

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const validatedInput = WebPageContentInputSchema.parse(parsedInput);
      
      const content = await this.client.getWebPageContent(validatedInput);

      return JSON.stringify({
        success: true,
        url: validatedInput.url,
        contentLength: content.length,
        maxLength: validatedInput.maxLength,
        content: content,
        truncated: content.length >= validatedInput.maxLength,
      }, null, 2);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WebPageContentTool execution failed', { input }, error as Error);
      
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
}

/**
 * LangChain Tool for getting API documentation
 */
export class APIDocumentationTool extends Tool {
  name = 'api_documentation';
  description = `Get API documentation and reference information.
  Input should be a JSON string with: {"api": "api_name", "method": "method_name", "version": "version"}
  Use this tool to get specific API method documentation and usage examples.`;

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const apiInput = z.object({
        api: z.string().min(1, 'API name is required'),
        method: z.string().optional(),
        version: z.string().optional(),
      }).parse(parsedInput);

      // This is a simplified implementation
      // In production, you would integrate with specific API documentation services
      const mockApiDocs = {
        'fetch': {
          description: 'The fetch() method is used to make HTTP requests in JavaScript',
          syntax: 'fetch(resource, options)',
          parameters: {
            resource: 'A string or Request object representing the resource to fetch',
            options: 'An optional object containing custom settings for the request',
          },
          returns: 'A Promise that resolves to the Response object',
          example: `
fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
          `,
        },
        'react.usestate': {
          description: 'useState is a React Hook that lets you add state to functional components',
          syntax: 'const [state, setState] = useState(initialState)',
          parameters: {
            initialState: 'The initial state value',
          },
          returns: 'An array with two elements: current state value and setter function',
          example: `
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
          `,
        },
      };

      const apiKey = apiInput.api.toLowerCase();
      const methodKey = apiInput.method ? `${apiKey}.${apiInput.method.toLowerCase()}` : apiKey;
      const documentation = mockApiDocs[methodKey as keyof typeof mockApiDocs] || mockApiDocs[apiKey as keyof typeof mockApiDocs];

      if (!documentation) {
        return JSON.stringify({
          success: false,
          error: `No documentation found for API: ${apiInput.api}${apiInput.method ? `.${apiInput.method}` : ''}`,
        }, null, 2);
      }

      return JSON.stringify({
        success: true,
        api: apiInput.api,
        method: apiInput.method,
        version: apiInput.version,
        documentation,
      }, null, 2);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('APIDocumentationTool execution failed', { input }, error as Error);
      
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
}

/**
 * Factory function to create documentation tools
 */
export function createDocumentationTools(): Tool[] {
  return [
    new DocumentationSearchTool(),
    new WebPageContentTool(),
    new APIDocumentationTool(),
  ];
}