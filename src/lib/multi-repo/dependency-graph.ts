/**
 * Dependency Graph System
 * 
 * Manages dependency detection, parsing, and graph construction for multi-repo workspaces.
 * Supports npm, Maven, Gradle, and Python package managers.
 * 
 * @module multi-repo/dependency-graph
 */

import { Octokit } from '@octokit/rest';
import { XMLParser } from 'fast-xml-parser';

/**
 * Supported package manager types
 */
export enum PackageManager {
  NPM = 'npm',
  MAVEN = 'maven',
  GRADLE = 'gradle',
  PYTHON = 'pip',
  UNKNOWN = 'unknown',
}

/**
 * Represents a single dependency in a project
 */
export interface Dependency {
  name: string;
  version: string;
  type: 'direct' | 'dev' | 'peer' | 'transitive';
  scope?: string;
  packageManager: PackageManager;
  repository?: string; // Which repository this dependency is from
}

/**
 * Represents a dependency graph node (a package/module)
 */
export interface DependencyNode {
  id: string; // Unique identifier (e.g., "repo:package@version")
  name: string;
  version: string;
  repository: string;
  packageManager: PackageManager;
  dependencies: string[]; // Array of dependency node IDs
  dependents: string[]; // Array of dependent node IDs
  metadata?: {
    description?: string;
    license?: string;
    homepage?: string;
  };
}

/**
 * Represents an edge in the dependency graph
 */
export interface DependencyEdge {
  from: string; // Source node ID
  to: string; // Target node ID
  type: 'direct' | 'dev' | 'peer' | 'transitive';
  versionConstraint?: string;
}

/**
 * Represents a complete dependency graph
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
  metadata: {
    workspaceId: string;
    generatedAt: Date;
    totalNodes: number;
    totalEdges: number;
    crossRepoLinks: number;
  };
}

/**
 * Result of dependency parsing
 */
export interface ParsedDependencies {
  packageManager: PackageManager;
  projectName?: string;
  projectVersion?: string;
  dependencies: Dependency[];
  devDependencies: Dependency[];
  peerDependencies?: Dependency[];
}

/**
 * Configuration for dependency analysis
 */
export interface DependencyAnalysisConfig {
  includeDevDependencies: boolean;
  includePeerDependencies: boolean;
  includeTransitiveDependencies: boolean;
  maxDepth: number; // Maximum depth for transitive dependencies
  ignorePatterns?: string[]; // Patterns to ignore (e.g., internal packages)
}

/**
 * Manages dependency graph construction and analysis
 */
export class DependencyGraphManager {
  private octokit: Octokit;
  private xmlParser: XMLParser;

  constructor(githubToken: string) {
    this.octokit = new Octokit({ auth: githubToken });
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * Detects the package manager used in a repository
   */
  async detectPackageManager(
    owner: string,
    repo: string,
    ref = 'main'
  ): Promise<PackageManager> {
    try {
      // Check for package.json (npm)
      try {
        await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'package.json',
          ref,
        });
        return PackageManager.NPM;
      } catch {
        // Continue checking
      }

      // Check for pom.xml (Maven)
      try {
        await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'pom.xml',
          ref,
        });
        return PackageManager.MAVEN;
      } catch {
        // Continue checking
      }

      // Check for build.gradle or build.gradle.kts (Gradle)
      try {
        await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'build.gradle',
          ref,
        });
        return PackageManager.GRADLE;
      } catch {
        try {
          await this.octokit.repos.getContent({
            owner,
            repo,
            path: 'build.gradle.kts',
            ref,
          });
          return PackageManager.GRADLE;
        } catch {
          // Continue checking
        }
      }

      // Check for requirements.txt or setup.py (Python)
      try {
        await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'requirements.txt',
          ref,
        });
        return PackageManager.PYTHON;
      } catch {
        try {
          await this.octokit.repos.getContent({
            owner,
            repo,
            path: 'setup.py',
            ref,
          });
          return PackageManager.PYTHON;
        } catch {
          // Continue checking
        }
      }

      return PackageManager.UNKNOWN;
    } catch (error) {
      console.error('Error detecting package manager:', error);
      return PackageManager.UNKNOWN;
    }
  }

  /**
   * Parses npm dependencies from package.json
   */
  async parseNpmDependencies(
    owner: string,
    repo: string,
    ref = 'main'
  ): Promise<ParsedDependencies> {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json',
        ref,
      });

      if (!('content' in response.data)) {
        throw new Error('package.json is not a file');
      }

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      const packageJson = JSON.parse(content);

      const dependencies: Dependency[] = [];
      const devDependencies: Dependency[] = [];
      const peerDependencies: Dependency[] = [];

      // Parse regular dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'direct',
            packageManager: PackageManager.NPM,
            repository: `${owner}/${repo}`,
          });
        }
      }

      // Parse dev dependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          devDependencies.push({
            name,
            version: version as string,
            type: 'dev',
            packageManager: PackageManager.NPM,
            repository: `${owner}/${repo}`,
          });
        }
      }

      // Parse peer dependencies
      if (packageJson.peerDependencies) {
        for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
          peerDependencies.push({
            name,
            version: version as string,
            type: 'peer',
            packageManager: PackageManager.NPM,
            repository: `${owner}/${repo}`,
          });
        }
      }

      return {
        packageManager: PackageManager.NPM,
        projectName: packageJson.name,
        projectVersion: packageJson.version,
        dependencies,
        devDependencies,
        peerDependencies,
      };
    } catch (error) {
      console.error('Error parsing npm dependencies:', error);
      throw error;
    }
  }

  /**
   * Parses Maven dependencies from pom.xml
   */
  async parseMavenDependencies(
    owner: string,
    repo: string,
    ref = 'main'
  ): Promise<ParsedDependencies> {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'pom.xml',
        ref,
      });

      if (!('content' in response.data)) {
        throw new Error('pom.xml is not a file');
      }

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      const pomData = this.xmlParser.parse(content);

      const dependencies: Dependency[] = [];
      const devDependencies: Dependency[] = [];

      const project = pomData.project || {};
      const projectName = project.artifactId || undefined;
      const projectVersion = project.version || undefined;

      // Parse dependencies
      if (project.dependencies?.dependency) {
        const deps = Array.isArray(project.dependencies.dependency)
          ? project.dependencies.dependency
          : [project.dependencies.dependency];

        for (const dep of deps) {
          const groupId = dep.groupId || '';
          const artifactId = dep.artifactId || '';
          const version = dep.version || 'latest';
          const scope = dep.scope || 'compile';

          const dependency: Dependency = {
            name: `${groupId}:${artifactId}`,
            version,
            type: scope === 'test' ? 'dev' : 'direct',
            scope,
            packageManager: PackageManager.MAVEN,
            repository: `${owner}/${repo}`,
          };

          if (scope === 'test') {
            devDependencies.push(dependency);
          } else {
            dependencies.push(dependency);
          }
        }
      }

      return {
        packageManager: PackageManager.MAVEN,
        projectName,
        projectVersion,
        dependencies,
        devDependencies,
      };
    } catch (error) {
      console.error('Error parsing Maven dependencies:', error);
      throw error;
    }
  }

  /**
   * Parses Gradle dependencies from build.gradle
   */
  async parseGradleDependencies(
    owner: string,
    repo: string,
    ref = 'main'
  ): Promise<ParsedDependencies> {
    try {
      let content: string;
      
      // Try build.gradle first
      try {
        const response = await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'build.gradle',
          ref,
        });

        if (!('content' in response.data)) {
          throw new Error('build.gradle is not a file');
        }

        content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      } catch {
        // Try build.gradle.kts
        const response = await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'build.gradle.kts',
          ref,
        });

        if (!('content' in response.data)) {
          throw new Error('build.gradle.kts is not a file');
        }

        content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      // Simple regex-based parsing for Gradle (basic implementation)
      const dependencies: Dependency[] = [];
      const devDependencies: Dependency[] = [];

      // Match implementation/compile dependencies
      const implementationRegex = /(?:implementation|compile)\s+['"]([^'"]+)['"]/g;
      let match;

      while ((match = implementationRegex.exec(content)) !== null) {
        const [group, name, version] = match[1].split(':');
        dependencies.push({
          name: `${group}:${name}`,
          version: version || 'latest',
          type: 'direct',
          packageManager: PackageManager.GRADLE,
          repository: `${owner}/${repo}`,
        });
      }

      // Match test dependencies
      const testRegex = /(?:testImplementation|testCompile)\s+['"]([^'"]+)['"]/g;
      while ((match = testRegex.exec(content)) !== null) {
        const [group, name, version] = match[1].split(':');
        devDependencies.push({
          name: `${group}:${name}`,
          version: version || 'latest',
          type: 'dev',
          packageManager: PackageManager.GRADLE,
          repository: `${owner}/${repo}`,
        });
      }

      return {
        packageManager: PackageManager.GRADLE,
        dependencies,
        devDependencies,
      };
    } catch (error) {
      console.error('Error parsing Gradle dependencies:', error);
      throw error;
    }
  }

  /**
   * Parses Python dependencies from requirements.txt
   */
  async parsePythonDependencies(
    owner: string,
    repo: string,
    ref = 'main'
  ): Promise<ParsedDependencies> {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'requirements.txt',
        ref,
      });

      if (!('content' in response.data)) {
        throw new Error('requirements.txt is not a file');
      }

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      const dependencies: Dependency[] = [];

      // Parse each line
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // Parse dependency (format: package==version or package>=version)
        const match = trimmed.match(/^([a-zA-Z0-9\-_]+)([=><~!]+)(.+)$/);
        if (match) {
          dependencies.push({
            name: match[1],
            version: match[3],
            type: 'direct',
            packageManager: PackageManager.PYTHON,
            repository: `${owner}/${repo}`,
          });
        } else if (/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
          // Package without version specified
          dependencies.push({
            name: trimmed,
            version: 'latest',
            type: 'direct',
            packageManager: PackageManager.PYTHON,
            repository: `${owner}/${repo}`,
          });
        }
      }

      return {
        packageManager: PackageManager.PYTHON,
        dependencies,
        devDependencies: [],
      };
    } catch (error) {
      console.error('Error parsing Python dependencies:', error);
      throw error;
    }
  }

  /**
   * Parses dependencies from a repository
   */
  async parseDependencies(
    owner: string,
    repo: string,
    ref = 'main'
  ): Promise<ParsedDependencies> {
    const packageManager = await this.detectPackageManager(owner, repo, ref);

    switch (packageManager) {
      case PackageManager.NPM:
        return this.parseNpmDependencies(owner, repo, ref);
      case PackageManager.MAVEN:
        return this.parseMavenDependencies(owner, repo, ref);
      case PackageManager.GRADLE:
        return this.parseGradleDependencies(owner, repo, ref);
      case PackageManager.PYTHON:
        return this.parsePythonDependencies(owner, repo, ref);
      default:
        return {
          packageManager: PackageManager.UNKNOWN,
          dependencies: [],
          devDependencies: [],
        };
    }
  }

  /**
   * Builds a dependency graph for a workspace
   */
  async buildDependencyGraph(
    workspaceId: string,
    repositories: Array<{ owner: string; name: string; defaultBranch?: string }>,
    config: Partial<DependencyAnalysisConfig> = {}
  ): Promise<DependencyGraph> {
    const defaultConfig: DependencyAnalysisConfig = {
      includeDevDependencies: false,
      includePeerDependencies: true,
      includeTransitiveDependencies: false,
      maxDepth: 3,
      ...config,
    };

    const nodes = new Map<string, DependencyNode>();
    const edges: DependencyEdge[] = [];
    let crossRepoLinks = 0;

    // Parse dependencies for each repository
    for (const repository of repositories) {
      try {
        const ref = repository.defaultBranch || 'main';
        const parsedDeps = await this.parseDependencies(
          repository.owner,
          repository.name,
          ref
        );

        const repoKey = `${repository.owner}/${repository.name}`;

        // Add repository as a root node
        const rootNodeId = `${repoKey}:root`;
        nodes.set(rootNodeId, {
          id: rootNodeId,
          name: parsedDeps.projectName || repository.name,
          version: parsedDeps.projectVersion || '1.0.0',
          repository: repoKey,
          packageManager: parsedDeps.packageManager,
          dependencies: [],
          dependents: [],
        });

        // Process direct dependencies
        for (const dep of parsedDeps.dependencies) {
          const depNodeId = `${repoKey}:${dep.name}@${dep.version}`;
          
          if (!nodes.has(depNodeId)) {
            nodes.set(depNodeId, {
              id: depNodeId,
              name: dep.name,
              version: dep.version,
              repository: repoKey,
              packageManager: dep.packageManager,
              dependencies: [],
              dependents: [],
            });
          }

          // Add edge
          edges.push({
            from: rootNodeId,
            to: depNodeId,
            type: dep.type,
            versionConstraint: dep.version,
          });

          // Update node relationships
          const rootNode = nodes.get(rootNodeId)!;
          const depNode = nodes.get(depNodeId)!;
          rootNode.dependencies.push(depNodeId);
          depNode.dependents.push(rootNodeId);
        }

        // Process dev dependencies if configured
        if (defaultConfig.includeDevDependencies) {
          for (const dep of parsedDeps.devDependencies) {
            const depNodeId = `${repoKey}:${dep.name}@${dep.version}`;
            
            if (!nodes.has(depNodeId)) {
              nodes.set(depNodeId, {
                id: depNodeId,
                name: dep.name,
                version: dep.version,
                repository: repoKey,
                packageManager: dep.packageManager,
                dependencies: [],
                dependents: [],
              });
            }

            edges.push({
              from: rootNodeId,
              to: depNodeId,
              type: dep.type,
              versionConstraint: dep.version,
            });

            const rootNode = nodes.get(rootNodeId)!;
            const depNode = nodes.get(depNodeId)!;
            rootNode.dependencies.push(depNodeId);
            depNode.dependents.push(rootNodeId);
          }
        }

        // Process peer dependencies if configured
        if (defaultConfig.includePeerDependencies && parsedDeps.peerDependencies) {
          for (const dep of parsedDeps.peerDependencies) {
            const depNodeId = `${repoKey}:${dep.name}@${dep.version}`;
            
            if (!nodes.has(depNodeId)) {
              nodes.set(depNodeId, {
                id: depNodeId,
                name: dep.name,
                version: dep.version,
                repository: repoKey,
                packageManager: dep.packageManager,
                dependencies: [],
                dependents: [],
              });
            }

            edges.push({
              from: rootNodeId,
              to: depNodeId,
              type: dep.type,
              versionConstraint: dep.version,
            });

            const rootNode = nodes.get(rootNodeId)!;
            const depNode = nodes.get(depNodeId)!;
            rootNode.dependencies.push(depNodeId);
            depNode.dependents.push(rootNodeId);
          }
        }
      } catch (error) {
        console.error(`Error processing repository ${repository.owner}/${repository.name}:`, error);
      }
    }

    // Detect cross-repo links
    for (const [, node] of nodes) {
      for (const depId of node.dependencies) {
        const depNode = nodes.get(depId);
        if (depNode && depNode.repository !== node.repository) {
          crossRepoLinks++;
        }
      }
    }

    return {
      nodes,
      edges,
      metadata: {
        workspaceId,
        generatedAt: new Date(),
        totalNodes: nodes.size,
        totalEdges: edges.length,
        crossRepoLinks,
      },
    };
  }
}
