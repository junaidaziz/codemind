/**
 * Dependency Graph Analyzer
 * 
 * Provides advanced analysis capabilities for dependency graphs including
 * cycle detection, impact analysis, vulnerability tracking, and metrics.
 * 
 * @module multi-repo/graph-analyzer
 */

import {
  DependencyGraph,
  PackageManager,
} from './dependency-graph';

/**
 * Represents a cycle in the dependency graph
 */
export interface DependencyCycle {
  nodes: string[]; // Node IDs in the cycle
  length: number;
  repositories: string[]; // Repositories involved
  severity: 'low' | 'medium' | 'high';
}

/**
 * Represents a cross-repository dependency link
 */
export interface CrossRepoLink {
  sourceRepo: string;
  targetRepo: string;
  dependencies: Array<{
    from: string;
    to: string;
    version: string;
  }>;
  type: 'direct' | 'transitive';
}

/**
 * Dependency health metrics
 */
export interface DependencyHealth {
  totalDependencies: number;
  directDependencies: number;
  devDependencies: number;
  outdatedCount: number;
  vulnerableCount: number;
  duplicateCount: number;
  averageDependencyDepth: number;
  maxDependencyDepth: number;
}

/**
 * Repository dependency metrics
 */
export interface RepositoryMetrics {
  repository: string;
  packageManager: PackageManager;
  dependencyCount: number;
  dependentCount: number; // How many other repos depend on this
  crossRepoDependencies: number;
  cyclomaticComplexity: number;
  health: DependencyHealth;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  targetNode: string;
  directImpact: string[]; // Nodes directly affected
  transitiveImpact: string[]; // Nodes transitively affected
  affectedRepositories: string[];
  impactScore: number; // 0-100
  criticalPath: string[][]; // Critical dependency paths
}

/**
 * Vulnerability in dependency
 */
export interface DependencyVulnerability {
  packageName: string;
  version: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cve?: string;
  description: string;
  fixedVersion?: string;
  affectedRepositories: string[];
}

/**
 * Analyzes dependency graphs for insights and issues
 */
export class GraphAnalyzer {
  private graph: DependencyGraph;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  /**
   * Detects circular dependencies in the graph
   */
  detectCycles(): DependencyCycle[] {
    const cycles: DependencyCycle[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      currentPath.push(nodeId);

      const node = this.graph.nodes.get(nodeId);
      if (!node) {
        currentPath.pop();
        recursionStack.delete(nodeId);
        return;
      }

      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          dfs(depId);
        } else if (recursionStack.has(depId)) {
          // Found a cycle
          const cycleStartIndex = currentPath.indexOf(depId);
          const cycleNodes = currentPath.slice(cycleStartIndex);
          
          const repositories = new Set<string>();
          for (const id of cycleNodes) {
            const n = this.graph.nodes.get(id);
            if (n) repositories.add(n.repository);
          }

          // Determine severity based on cycle length and cross-repo involvement
          let severity: 'low' | 'medium' | 'high' = 'low';
          if (repositories.size > 1) {
            severity = 'high'; // Cross-repo cycles are critical
          } else if (cycleNodes.length > 5) {
            severity = 'medium';
          }

          cycles.push({
            nodes: [...cycleNodes, depId], // Complete the cycle
            length: cycleNodes.length,
            repositories: Array.from(repositories),
            severity,
          });
        }
      }

      currentPath.pop();
      recursionStack.delete(nodeId);
    };

    // Run DFS from each unvisited node
    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Identifies all cross-repository dependency links
   */
  findCrossRepoLinks(): CrossRepoLink[] {
    const linksMap = new Map<string, CrossRepoLink>();

    for (const edge of this.graph.edges) {
      const sourceNode = this.graph.nodes.get(edge.from);
      const targetNode = this.graph.nodes.get(edge.to);

      if (!sourceNode || !targetNode) continue;

      if (sourceNode.repository !== targetNode.repository) {
        const key = `${sourceNode.repository}->${targetNode.repository}`;
        
        if (!linksMap.has(key)) {
          linksMap.set(key, {
            sourceRepo: sourceNode.repository,
            targetRepo: targetNode.repository,
            dependencies: [],
            type: edge.type === 'transitive' ? 'transitive' : 'direct',
          });
        }

        const link = linksMap.get(key)!;
        link.dependencies.push({
          from: sourceNode.name,
          to: targetNode.name,
          version: targetNode.version,
        });
      }
    }

    return Array.from(linksMap.values());
  }

  /**
   * Calculates metrics for each repository in the workspace
   */
  calculateRepositoryMetrics(): RepositoryMetrics[] {
    const repoMap = new Map<string, RepositoryMetrics>();

    // Initialize metrics for each repository
    for (const node of this.graph.nodes.values()) {
      if (!repoMap.has(node.repository)) {
        repoMap.set(node.repository, {
          repository: node.repository,
          packageManager: node.packageManager,
          dependencyCount: 0,
          dependentCount: 0,
          crossRepoDependencies: 0,
          cyclomaticComplexity: 0,
          health: {
            totalDependencies: 0,
            directDependencies: 0,
            devDependencies: 0,
            outdatedCount: 0,
            vulnerableCount: 0,
            duplicateCount: 0,
            averageDependencyDepth: 0,
            maxDependencyDepth: 0,
          },
        });
      }
    }

    // Calculate dependency counts
    for (const node of this.graph.nodes.values()) {
      const metrics = repoMap.get(node.repository)!;
      metrics.dependencyCount += node.dependencies.length;
      metrics.dependentCount += node.dependents.length;
      metrics.health.totalDependencies++;

      // Count cross-repo dependencies
      for (const depId of node.dependencies) {
        const depNode = this.graph.nodes.get(depId);
        if (depNode && depNode.repository !== node.repository) {
          metrics.crossRepoDependencies++;
        }
      }
    }

    // Calculate dependency depths
    for (const [repo, metrics] of repoMap) {
      const depths: number[] = [];
      
      for (const node of this.graph.nodes.values()) {
        if (node.repository === repo) {
          const depth = this.calculateNodeDepth(node.id);
          depths.push(depth);
        }
      }

      if (depths.length > 0) {
        metrics.health.maxDependencyDepth = Math.max(...depths);
        metrics.health.averageDependencyDepth = 
          depths.reduce((a, b) => a + b, 0) / depths.length;
      }

      // Calculate cyclomatic complexity (simplified)
      metrics.cyclomaticComplexity = this.calculateComplexity(repo);
    }

    // Count direct dependencies from edges
    for (const edge of this.graph.edges) {
      const sourceNode = this.graph.nodes.get(edge.from);
      if (sourceNode) {
        const metrics = repoMap.get(sourceNode.repository)!;
        if (edge.type === 'direct') {
          metrics.health.directDependencies++;
        } else if (edge.type === 'dev') {
          metrics.health.devDependencies++;
        }
      }
    }

    return Array.from(repoMap.values());
  }

  /**
   * Performs impact analysis for a given node
   */
  analyzeImpact(nodeId: string): ImpactAnalysis | null {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return null;

    const directImpact = new Set<string>();
    const transitiveImpact = new Set<string>();
    const affectedRepositories = new Set<string>();
    const criticalPaths: string[][] = [];

    // Find all nodes that depend on this node (direct impact)
    for (const dependentId of node.dependents) {
      directImpact.add(dependentId);
      const depNode = this.graph.nodes.get(dependentId);
      if (depNode) {
        affectedRepositories.add(depNode.repository);
      }
    }

    // Find all nodes that transitively depend on this node
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = 
      Array.from(directImpact).map(id => ({ id, path: [nodeId, id] }));

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      
      visited.add(current.id);
      transitiveImpact.add(current.id);

      const currentNode = this.graph.nodes.get(current.id);
      if (!currentNode) continue;

      affectedRepositories.add(currentNode.repository);

      // Track critical paths (paths crossing multiple repos)
      if (current.path.length > 2) {
        const pathRepos = current.path.map(id => {
          const n = this.graph.nodes.get(id);
          return n?.repository || '';
        });
        const uniqueRepos = new Set(pathRepos);
        if (uniqueRepos.size > 1) {
          criticalPaths.push(current.path);
        }
      }

      // Add dependents to queue
      for (const dependentId of currentNode.dependents) {
        if (!visited.has(dependentId)) {
          queue.push({
            id: dependentId,
            path: [...current.path, dependentId],
          });
        }
      }
    }

    // Calculate impact score (0-100)
    const totalNodes = this.graph.nodes.size;
    const affectedCount = directImpact.size + transitiveImpact.size;
    const impactScore = Math.min(100, Math.round((affectedCount / totalNodes) * 100));

    return {
      targetNode: nodeId,
      directImpact: Array.from(directImpact),
      transitiveImpact: Array.from(transitiveImpact),
      affectedRepositories: Array.from(affectedRepositories),
      impactScore,
      criticalPath: criticalPaths.slice(0, 10), // Top 10 critical paths
    };
  }

  /**
   * Finds duplicate dependencies across repositories
   */
  findDuplicateDependencies(): Map<string, Array<{ repository: string; version: string }>> {
    const dependencyMap = new Map<string, Array<{ repository: string; version: string }>>();

    for (const node of this.graph.nodes.values()) {
      // Skip root nodes
      if (node.id.endsWith(':root')) continue;

      if (!dependencyMap.has(node.name)) {
        dependencyMap.set(node.name, []);
      }

      dependencyMap.get(node.name)!.push({
        repository: node.repository,
        version: node.version,
      });
    }

    // Filter to only duplicates (same package, different versions)
    const duplicates = new Map<string, Array<{ repository: string; version: string }>>();
    
    for (const [name, versions] of dependencyMap) {
      const uniqueVersions = new Set(versions.map(v => v.version));
      if (uniqueVersions.size > 1) {
        duplicates.set(name, versions);
      }
    }

    return duplicates;
  }

  /**
   * Generates a visualization-ready graph structure
   */
  generateVisualizationData(): {
    nodes: Array<{ id: string; label: string; group: string; value: number }>;
    edges: Array<{ from: string; to: string; label?: string; dashes?: boolean }>;
  } {
    const nodes: Array<{ id: string; label: string; group: string; value: number }> = [];
    const edges: Array<{ from: string; to: string; label?: string; dashes?: boolean }> = [];

    // Convert nodes
    for (const node of this.graph.nodes.values()) {
      nodes.push({
        id: node.id,
        label: `${node.name}@${node.version}`,
        group: node.repository,
        value: node.dependents.length + 1, // Size based on dependents
      });
    }

    // Convert edges
    for (const edge of this.graph.edges) {
      edges.push({
        from: edge.from,
        to: edge.to,
        label: edge.type === 'dev' ? 'dev' : undefined,
        dashes: edge.type === 'dev',
      });
    }

    return { nodes, edges };
  }

  /**
   * Calculates the depth of a node in the dependency tree
   */
  private calculateNodeDepth(nodeId: string, visited = new Set<string>()): number {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);

    const node = this.graph.nodes.get(nodeId);
    if (!node || node.dependencies.length === 0) return 0;

    let maxDepth = 0;
    for (const depId of node.dependencies) {
      const depth = this.calculateNodeDepth(depId, visited);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth + 1;
  }

  /**
   * Calculates cyclomatic complexity for a repository
   */
  private calculateComplexity(repository: string): number {
    let edges = 0;
    let nodes = 0;

    for (const node of this.graph.nodes.values()) {
      if (node.repository === repository) {
        nodes++;
        edges += node.dependencies.length;
      }
    }

    // Simplified cyclomatic complexity: E - N + 2P
    // Where E = edges, N = nodes, P = connected components (assume 1)
    return Math.max(1, edges - nodes + 2);
  }

  /**
   * Finds the shortest path between two nodes
   */
  findShortestPath(fromId: string, toId: string): string[] | null {
    if (!this.graph.nodes.has(fromId) || !this.graph.nodes.has(toId)) {
      return null;
    }

    const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.id === toId) {
        return current.path;
      }

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const node = this.graph.nodes.get(current.id);
      if (!node) continue;

      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          queue.push({
            id: depId,
            path: [...current.path, depId],
          });
        }
      }
    }

    return null;
  }

  /**
   * Gets all dependency paths from a node
   */
  getAllPaths(fromId: string, maxDepth = 10): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string, currentPath: string[], depth: number): void => {
      if (depth > maxDepth || visited.has(nodeId)) return;

      currentPath.push(nodeId);
      visited.add(nodeId);

      const node = this.graph.nodes.get(nodeId);
      if (!node || node.dependencies.length === 0) {
        paths.push([...currentPath]);
      } else {
        for (const depId of node.dependencies) {
          dfs(depId, currentPath, depth + 1);
        }
      }

      currentPath.pop();
      visited.delete(nodeId);
    };

    dfs(fromId, [], 0);
    return paths;
  }

  /**
   * Generates a summary of the dependency graph
   */
  generateSummary(): {
    totalRepositories: number;
    totalDependencies: number;
    crossRepoLinks: number;
    cycles: number;
    averageDependenciesPerRepo: number;
    mostDependedOn: Array<{ node: string; count: number }>;
    mostDependent: Array<{ node: string; count: number }>;
  } {
    const repositories = new Set<string>();
    const cycles = this.detectCycles();

    for (const node of this.graph.nodes.values()) {
      repositories.add(node.repository);
    }

    // Find most depended on packages
    const dependentCounts = new Map<string, number>();
    for (const node of this.graph.nodes.values()) {
      dependentCounts.set(node.id, node.dependents.length);
    }

    const mostDependedOn = Array.from(dependentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([node, count]) => ({ node, count }));

    // Find most dependent packages
    const dependencyCounts = new Map<string, number>();
    for (const node of this.graph.nodes.values()) {
      dependencyCounts.set(node.id, node.dependencies.length);
    }

    const mostDependent = Array.from(dependencyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([node, count]) => ({ node, count }));

    return {
      totalRepositories: repositories.size,
      totalDependencies: this.graph.nodes.size,
      crossRepoLinks: this.graph.metadata.crossRepoLinks,
      cycles: cycles.length,
      averageDependenciesPerRepo: this.graph.nodes.size / repositories.size,
      mostDependedOn,
      mostDependent,
    };
  }
}
