/**
 * Tests for Graph Analyzer
 * 
 * Tests cycle detection, cross-repo analysis, and metrics calculation
 */

import { GraphAnalyzer } from '../graph-analyzer';
import { DependencyGraph, PackageManager } from '../dependency-graph';

describe('GraphAnalyzer', () => {
  describe('detectCycles', () => {
    it('should detect simple cycle', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: ['C'] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['C'], dependents: ['A'] }],
          ['C', { id: 'C', name: 'pkg-c', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['A'], dependents: ['B'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', type: 'direct' },
          { from: 'B', to: 'C', type: 'direct' },
          { from: 'C', to: 'A', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 3,
          totalEdges: 3,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const cycles = analyzer.detectCycles();

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0].nodes).toContain('A');
      expect(cycles[0].nodes).toContain('B');
      expect(cycles[0].nodes).toContain('C');
    });

    it('should detect cross-repo cycle with high severity', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: ['B'] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo2', packageManager: PackageManager.NPM, dependencies: ['A'], dependents: ['A'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', type: 'direct' },
          { from: 'B', to: 'A', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 2,
          totalEdges: 2,
          crossRepoLinks: 2,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const cycles = analyzer.detectCycles();

      expect(cycles[0].severity).toBe('high');
      expect(cycles[0].repositories.length).toBe(2);
    });

    it('should return empty array for acyclic graph', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A'] }],
        ]),
        edges: [{ from: 'A', to: 'B', type: 'direct' }],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 2,
          totalEdges: 1,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const cycles = analyzer.detectCycles();

      expect(cycles).toHaveLength(0);
    });

    it('should classify long cycles as medium severity', () => {
      const nodes = new Map();
      const edges = [];
      
      // Create a cycle with 7 nodes
      for (let i = 0; i < 7; i++) {
        const id = `node${i}`;
        const nextId = `node${(i + 1) % 7}`;
        nodes.set(id, {
          id,
          name: `pkg-${i}`,
          version: '1.0.0',
          repository: 'repo1',
          packageManager: PackageManager.NPM,
          dependencies: [nextId],
          dependents: [i === 0 ? `node${6}` : `node${i - 1}`],
        });
        edges.push({ from: id, to: nextId, type: 'direct' as const });
      }

      const graph: DependencyGraph = {
        nodes,
        edges,
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 7,
          totalEdges: 7,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const cycles = analyzer.detectCycles();

      expect(cycles[0].severity).toBe('medium');
      expect(cycles[0].length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('findCrossRepoLinks', () => {
    it('should find cross-repository dependencies', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo2', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A'] }],
          ['C', { id: 'C', name: 'pkg-c', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['D'], dependents: [] }],
          ['D', { id: 'D', name: 'pkg-d', version: '1.0.0', repository: 'repo3', packageManager: PackageManager.NPM, dependencies: [], dependents: ['C'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', type: 'direct' },
          { from: 'C', to: 'D', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 4,
          totalEdges: 2,
          crossRepoLinks: 2,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const links = analyzer.findCrossRepoLinks();

      expect(links).toHaveLength(2);
      expect(links[0].sourceRepo).toBe('repo1');
      expect(links[0].targetRepo).toBe('repo2');
      expect(links[0].dependencies).toHaveLength(1);
    });

    it('should return empty array for single-repo graph', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A'] }],
        ]),
        edges: [{ from: 'A', to: 'B', type: 'direct' }],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 2,
          totalEdges: 1,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const links = analyzer.findCrossRepoLinks();

      expect(links).toHaveLength(0);
    });

    it('should group multiple dependencies between same repos', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A1', { id: 'A1', name: 'pkg-a1', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B1'], dependents: [] }],
          ['A2', { id: 'A2', name: 'pkg-a2', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B2'], dependents: [] }],
          ['B1', { id: 'B1', name: 'pkg-b1', version: '1.0.0', repository: 'repo2', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A1'] }],
          ['B2', { id: 'B2', name: 'pkg-b2', version: '1.0.0', repository: 'repo2', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A2'] }],
        ]),
        edges: [
          { from: 'A1', to: 'B1', type: 'direct' },
          { from: 'A2', to: 'B2', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 4,
          totalEdges: 2,
          crossRepoLinks: 2,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const links = analyzer.findCrossRepoLinks();

      expect(links).toHaveLength(1); // Grouped into one link
      expect(links[0].dependencies).toHaveLength(2);
    });
  });

  describe('calculateRepositoryMetrics', () => {
    it('should calculate metrics for each repository', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B', 'C'], dependents: [] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A'] }],
          ['C', { id: 'C', name: 'pkg-c', version: '1.0.0', repository: 'repo2', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', type: 'direct' },
          { from: 'A', to: 'C', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 3,
          totalEdges: 2,
          crossRepoLinks: 1,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const metrics = analyzer.calculateRepositoryMetrics();

      expect(metrics).toHaveLength(2);
      
      const repo1Metrics = metrics.find(m => m.repository === 'repo1');
      expect(repo1Metrics).toBeDefined();
      expect(repo1Metrics!.dependencyCount).toBeGreaterThan(0);
      expect(repo1Metrics!.crossRepoDependencies).toBe(1);
    });

    it('should calculate dependency depths', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['C'], dependents: ['A'] }],
          ['C', { id: 'C', name: 'pkg-c', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: ['B'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', type: 'direct' },
          { from: 'B', to: 'C', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 3,
          totalEdges: 2,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const metrics = analyzer.calculateRepositoryMetrics();

      expect(metrics[0].health.maxDependencyDepth).toBeGreaterThan(0);
      expect(metrics[0].health.averageDependencyDepth).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeImpact', () => {
    it('should calculate direct and transitive impact', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: ['B'] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['A'], dependents: ['C'] }],
          ['C', { id: 'C', name: 'pkg-c', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
        ]),
        edges: [
          { from: 'B', to: 'A', type: 'direct' },
          { from: 'C', to: 'B', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 3,
          totalEdges: 2,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const impact = analyzer.analyzeImpact('A');

      expect(impact).toBeDefined();
      expect(impact!.directImpact).toContain('B');
      expect(impact!.transitiveImpact).toContain('C');
      expect(impact!.impactScore).toBeGreaterThan(0);
    });

    it('should return null for non-existent node', () => {
      const graph: DependencyGraph = {
        nodes: new Map(),
        edges: [],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 0,
          totalEdges: 0,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const impact = analyzer.analyzeImpact('nonexistent');

      expect(impact).toBeNull();
    });

    it('should identify critical cross-repo paths', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: ['B'] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo2', packageManager: PackageManager.NPM, dependencies: ['A'], dependents: ['C'] }],
          ['C', { id: 'C', name: 'pkg-c', version: '1.0.0', repository: 'repo3', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
        ]),
        edges: [
          { from: 'B', to: 'A', type: 'direct' },
          { from: 'C', to: 'B', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 3,
          totalEdges: 2,
          crossRepoLinks: 2,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const impact = analyzer.analyzeImpact('A');

      expect(impact!.criticalPath.length).toBeGreaterThan(0);
      expect(impact!.affectedRepositories.length).toBeGreaterThan(1);
    });

    it('should calculate impact score correctly', () => {
      const nodes = new Map();
      // Create 10 nodes, where node A affects 5 others
      for (let i = 0; i < 10; i++) {
        nodes.set(`node${i}`, {
          id: `node${i}`,
          name: `pkg-${i}`,
          version: '1.0.0',
          repository: 'repo1',
          packageManager: PackageManager.NPM,
          dependencies: i === 0 ? [] : ['node0'],
          dependents: i === 0 ? ['node1', 'node2', 'node3', 'node4', 'node5'] : [],
        });
      }

      const graph: DependencyGraph = {
        nodes,
        edges: [],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 10,
          totalEdges: 0,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const impact = analyzer.analyzeImpact('node0');

      expect(impact!.impactScore).toBeGreaterThan(0);
      expect(impact!.impactScore).toBeLessThanOrEqual(100);
    });
  });

  describe('findDuplicateDependencies', () => {
    it('should find packages with different versions', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A:react@18.0.0', { id: 'A:react@18.0.0', name: 'react', version: '18.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: [] }],
          ['B:react@17.0.0', { id: 'B:react@17.0.0', name: 'react', version: '17.0.0', repository: 'repo2', packageManager: PackageManager.NPM, dependencies: [], dependents: [] }],
          ['C:lodash@4.17.21', { id: 'C:lodash@4.17.21', name: 'lodash', version: '4.17.21', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: [] }],
        ]),
        edges: [],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 3,
          totalEdges: 0,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const duplicates = analyzer.findDuplicateDependencies();

      expect(duplicates.has('react')).toBe(true);
      expect(duplicates.get('react')?.length).toBe(2);
      expect(duplicates.has('lodash')).toBe(false); // Only one version
    });

    it('should return empty for no duplicates', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'react', version: '18.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: [] }],
          ['B', { id: 'B', name: 'lodash', version: '4.17.21', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: [] }],
        ]),
        edges: [],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 2,
          totalEdges: 0,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const duplicates = analyzer.findDuplicateDependencies();

      expect(duplicates.size).toBe(0);
    });
  });

  describe('findShortestPath', () => {
    it('should find shortest path between nodes', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B', 'C'], dependents: [] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['D'], dependents: ['A'] }],
          ['C', { id: 'C', name: 'pkg-c', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['D'], dependents: ['A'] }],
          ['D', { id: 'D', name: 'pkg-d', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: ['B', 'C'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', type: 'direct' },
          { from: 'A', to: 'C', type: 'direct' },
          { from: 'B', to: 'D', type: 'direct' },
          { from: 'C', to: 'D', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 4,
          totalEdges: 4,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const path = analyzer.findShortestPath('A', 'D');

      expect(path).toBeDefined();
      expect(path![0]).toBe('A');
      expect(path![path!.length - 1]).toBe('D');
      expect(path!.length).toBe(3); // A -> B/C -> D
    });

    it('should return null for unreachable nodes', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: [] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: [] }],
        ]),
        edges: [],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 2,
          totalEdges: 0,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const path = analyzer.findShortestPath('A', 'B');

      expect(path).toBeNull();
    });
  });

  describe('generateSummary', () => {
    it('should generate comprehensive summary', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo2', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A', 'C'] }],
          ['C', { id: 'C', name: 'pkg-c', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
        ]),
        edges: [
          { from: 'A', to: 'B', type: 'direct' },
          { from: 'C', to: 'B', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 3,
          totalEdges: 2,
          crossRepoLinks: 2,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const summary = analyzer.generateSummary();

      expect(summary.totalRepositories).toBe(2);
      expect(summary.totalDependencies).toBe(3);
      expect(summary.crossRepoLinks).toBe(2);
      expect(summary.mostDependedOn).toBeDefined();
      expect(summary.mostDependedOn.length).toBeGreaterThan(0);
      expect(summary.mostDependent).toBeDefined();
    });

    it('should identify most depended on packages', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: ['B', 'C', 'D'] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['A'], dependents: [] }],
          ['C', { id: 'C', name: 'pkg-c', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['A'], dependents: [] }],
          ['D', { id: 'D', name: 'pkg-d', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['A'], dependents: [] }],
        ]),
        edges: [],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 4,
          totalEdges: 0,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const summary = analyzer.generateSummary();

      expect(summary.mostDependedOn[0].node).toBe('A');
      expect(summary.mostDependedOn[0].count).toBe(3);
    });
  });

  describe('generateVisualizationData', () => {
    it('should generate visualization-ready data', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
          ['B', { id: 'B', name: 'pkg-b', version: '1.0.0', repository: 'repo2', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', type: 'direct' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 2,
          totalEdges: 1,
          crossRepoLinks: 1,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const vizData = analyzer.generateVisualizationData();

      expect(vizData.nodes).toHaveLength(2);
      expect(vizData.edges).toHaveLength(1);
      expect(vizData.nodes[0]).toHaveProperty('id');
      expect(vizData.nodes[0]).toHaveProperty('label');
      expect(vizData.nodes[0]).toHaveProperty('group');
      expect(vizData.nodes[0]).toHaveProperty('value');
      expect(vizData.edges[0]).toHaveProperty('from');
      expect(vizData.edges[0]).toHaveProperty('to');
    });

    it('should mark dev dependencies with dashes', () => {
      const graph: DependencyGraph = {
        nodes: new Map([
          ['A', { id: 'A', name: 'pkg-a', version: '1.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: ['B'], dependents: [] }],
          ['B', { id: 'B', name: 'jest', version: '29.0.0', repository: 'repo1', packageManager: PackageManager.NPM, dependencies: [], dependents: ['A'] }],
        ]),
        edges: [
          { from: 'A', to: 'B', type: 'dev' },
        ],
        metadata: {
          workspaceId: 'test',
          generatedAt: new Date(),
          totalNodes: 2,
          totalEdges: 1,
          crossRepoLinks: 0,
        },
      };

      const analyzer = new GraphAnalyzer(graph);
      const vizData = analyzer.generateVisualizationData();

      expect(vizData.edges[0].dashes).toBe(true);
      expect(vizData.edges[0].label).toBe('dev');
    });
  });
});
