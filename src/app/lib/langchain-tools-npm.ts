import { Tool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from './logger';

// Input schemas for NPM operations
export const NPMSearchInputSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  size: z.number().min(1).max(250).default(20), // Limit results
  from: z.number().min(0).default(0), // Pagination offset
});

export const NPMPackageDetailsInputSchema = z.object({
  packageName: z.string().min(1, 'Package name is required'),
  version: z.string().optional(), // Specific version, defaults to latest
});

// Response schemas
export const NPMPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  author: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  maintainers: z.array(z.object({
    username: z.string(),
    email: z.string().optional(),
  })).optional(),
  homepage: z.string().optional(),
  repository: z.object({
    type: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
  license: z.string().optional(),
  downloads: z.object({
    lastDay: z.number().optional(),
    lastWeek: z.number().optional(),
    lastMonth: z.number().optional(),
  }).optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  engines: z.record(z.string(), z.string()).optional(),
  readme: z.string().optional(),
});

export const NPMSearchResultSchema = z.object({
  total: z.number(),
  results: z.array(z.object({
    package: NPMPackageSchema,
    score: z.object({
      final: z.number(),
      detail: z.object({
        quality: z.number(),
        popularity: z.number(),
        maintenance: z.number(),
      }),
    }),
    searchScore: z.number().optional(),
  })),
});

export type NPMSearchInput = z.infer<typeof NPMSearchInputSchema>;
export type NPMPackageDetailsInput = z.infer<typeof NPMPackageDetailsInputSchema>;
export type NPMPackage = z.infer<typeof NPMPackageSchema>;
export type NPMSearchResult = z.infer<typeof NPMSearchResultSchema>;

/**
 * NPM Registry API client
 */
class NPMAPIClient {
  private searchBaseUrl = 'https://registry.npmjs.org/-/v1/search';
  private registryBaseUrl = 'https://registry.npmjs.org';
  private downloadsBaseUrl = 'https://api.npmjs.org/downloads/point';

  async searchPackages(input: NPMSearchInput): Promise<NPMSearchResult> {
    const { query, size, from } = input;
    const url = `${this.searchBaseUrl}?text=${encodeURIComponent(query)}&size=${size}&from=${from}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CodeMind-Bot/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`NPM Search API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return NPMSearchResultSchema.parse(data);

    } catch (error) {
      logger.error('Failed to search NPM packages', { query, size, from }, error as Error);
      throw error;
    }
  }

  async getPackageDetails(input: NPMPackageDetailsInput): Promise<NPMPackage> {
    const { packageName, version } = input;
    const packagePath = version ? `${packageName}/${version}` : packageName;
    const url = `${this.registryBaseUrl}/${packagePath}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CodeMind-Bot/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`NPM Registry API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different response formats (versioned vs latest)
      const packageData = version ? data : data['dist-tags'] ? data.versions[data['dist-tags'].latest] : data;

      // Get download statistics
      const downloads = await this.getDownloadStats(packageName).catch(() => undefined);

      const packageInfo: NPMPackage = {
        name: packageData.name,
        version: packageData.version,
        description: packageData.description,
        keywords: packageData.keywords,
        author: packageData.author ? {
          name: typeof packageData.author === 'string' ? packageData.author : packageData.author.name,
          email: typeof packageData.author === 'object' ? packageData.author.email : undefined,
        } : undefined,
        maintainers: packageData.maintainers?.map((m: { name?: string; username?: string; email?: string }) => ({
          username: m.name || m.username || '',
          email: m.email,
        })),
        homepage: packageData.homepage,
        repository: packageData.repository ? {
          type: packageData.repository.type,
          url: packageData.repository.url,
        } : undefined,
        license: typeof packageData.license === 'string' ? packageData.license : packageData.license?.type,
        downloads,
        publishedAt: packageData.time?.[packageData.version],
        updatedAt: packageData.time?.modified,
        dependencies: packageData.dependencies,
        devDependencies: packageData.devDependencies,
        peerDependencies: packageData.peerDependencies,
        engines: packageData.engines,
        readme: packageData.readme?.substring(0, 2000), // Truncate for brevity
      };

      return NPMPackageSchema.parse(packageInfo);

    } catch (error) {
      logger.error('Failed to fetch NPM package details', { packageName, version }, error as Error);
      throw error;
    }
  }

  private async getDownloadStats(packageName: string): Promise<NPMPackage['downloads']> {
    try {
      const [lastDay, lastWeek, lastMonth] = await Promise.all([
        this.fetchDownloadCount(packageName, 'last-day'),
        this.fetchDownloadCount(packageName, 'last-week'),
        this.fetchDownloadCount(packageName, 'last-month'),
      ]);

      return { lastDay, lastWeek, lastMonth };
    } catch (error) {
      logger.warn('Failed to fetch download stats', { packageName }, error as Error);
      return undefined;
    }
  }

  private async fetchDownloadCount(packageName: string, period: string): Promise<number> {
    const url = `${this.downloadsBaseUrl}/${period}/${packageName}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Download stats API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.downloads || 0;
  }
}

/**
 * LangChain Tool for searching NPM packages
 */
export class NPMSearchTool extends Tool {
  name = 'npm_search';
  description = `Search for NPM packages by query. 
  Input should be a JSON string with: {"query": "search_term", "size": 20, "from": 0}
  Use this tool when you need to find NPM packages for specific functionality or technologies.`;

  private client: NPMAPIClient = new NPMAPIClient();

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const validatedInput = NPMSearchInputSchema.parse(parsedInput);
      
      const searchResult = await this.client.searchPackages(validatedInput);

      // Format results for better readability
      const formattedResults = searchResult.results.map(result => ({
        name: result.package.name,
        version: result.package.version,
        description: result.package.description,
        author: result.package.author?.name,
        license: result.package.license,
        homepage: result.package.homepage,
        repository: result.package.repository?.url,
        keywords: result.package.keywords?.slice(0, 5), // Limit keywords
        score: {
          overall: Math.round(result.score.final * 100) / 100,
          quality: Math.round(result.score.detail.quality * 100) / 100,
          popularity: Math.round(result.score.detail.popularity * 100) / 100,
          maintenance: Math.round(result.score.detail.maintenance * 100) / 100,
        },
      }));

      return JSON.stringify({
        success: true,
        query: validatedInput.query,
        total: searchResult.total,
        resultsShown: formattedResults.length,
        packages: formattedResults,
      }, null, 2);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('NPMSearchTool execution failed', { input }, error as Error);
      
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
}

/**
 * LangChain Tool for getting detailed NPM package information
 */
export class NPMPackageDetailsTool extends Tool {
  name = 'npm_package_details';
  description = `Get detailed information about a specific NPM package.
  Input should be a JSON string with: {"packageName": "package-name", "version": "1.0.0"}
  Version is optional - if not provided, latest version info will be returned.
  Use this tool to get comprehensive information about a specific package.`;

  private client: NPMAPIClient = new NPMAPIClient();

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const validatedInput = NPMPackageDetailsInputSchema.parse(parsedInput);
      
      const packageDetails = await this.client.getPackageDetails(validatedInput);

      // Format for better readability
      const formattedDetails = {
        name: packageDetails.name,
        version: packageDetails.version,
        description: packageDetails.description,
        author: packageDetails.author,
        maintainers: packageDetails.maintainers?.slice(0, 3), // Limit maintainers
        license: packageDetails.license,
        homepage: packageDetails.homepage,
        repository: packageDetails.repository,
        keywords: packageDetails.keywords,
        downloads: packageDetails.downloads,
        publishedAt: packageDetails.publishedAt,
        updatedAt: packageDetails.updatedAt,
        dependencies: packageDetails.dependencies ? Object.keys(packageDetails.dependencies).length : 0,
        devDependencies: packageDetails.devDependencies ? Object.keys(packageDetails.devDependencies).length : 0,
        peerDependencies: packageDetails.peerDependencies ? Object.keys(packageDetails.peerDependencies).length : 0,
        engines: packageDetails.engines,
        topDependencies: packageDetails.dependencies ? 
          Object.entries(packageDetails.dependencies).slice(0, 10) : undefined,
        readmePreview: packageDetails.readme?.substring(0, 500) + 
          (packageDetails.readme && packageDetails.readme.length > 500 ? '...' : ''),
      };

      return JSON.stringify({
        success: true,
        package: formattedDetails,
      }, null, 2);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('NPMPackageDetailsTool execution failed', { input }, error as Error);
      
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
}

/**
 * LangChain Tool for comparing NPM packages
 */
export class NPMPackageCompareTool extends Tool {
  name = 'npm_package_compare';
  description = `Compare multiple NPM packages side by side.
  Input should be a JSON string with: {"packages": ["package1", "package2", "package3"]}
  Use this tool to help choose between different package alternatives.`;

  private client: NPMAPIClient = new NPMAPIClient();

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const compareInput = z.object({
        packages: z.array(z.string().min(1)).min(2).max(5), // Compare 2-5 packages
      }).parse(parsedInput);

      const packagePromises = compareInput.packages.map(packageName =>
        this.client.getPackageDetails({ packageName }).catch(error => ({
          name: packageName,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      );

      const packages = await Promise.all(packagePromises);

      // Separate successful and failed fetches
      const successful = packages.filter(p => !('error' in p)) as NPMPackage[];
      const failed = packages.filter(p => 'error' in p);

      // Create comparison matrix
      const comparison = {
        successful: successful.map(pkg => ({
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          license: pkg.license,
          downloads: pkg.downloads,
          dependencyCount: pkg.dependencies ? Object.keys(pkg.dependencies).length : 0,
          publishedAt: pkg.publishedAt,
          author: pkg.author?.name,
          repository: pkg.repository?.url,
          keywords: pkg.keywords?.slice(0, 5),
        })),
        failed: failed.map(f => ({
          name: 'name' in f ? f.name : 'unknown',
          error: 'error' in f ? f.error : 'unknown error',
        })),
      };

      return JSON.stringify({
        success: true,
        comparison,
        summary: {
          totalPackages: compareInput.packages.length,
          successfulFetches: successful.length,
          failedFetches: failed.length,
          mostPopular: successful.length > 0 ? 
            successful.reduce((prev, current) => 
              (current.downloads?.lastMonth || 0) > (prev.downloads?.lastMonth || 0) ? current : prev
            ).name : null,
        },
      }, null, 2);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('NPMPackageCompareTool execution failed', { input }, error as Error);
      
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
}

/**
 * Factory function to create NPM tools
 */
export function createNPMTools(): Tool[] {
  return [
    new NPMSearchTool(),
    new NPMPackageDetailsTool(),
    new NPMPackageCompareTool(),
  ];
}