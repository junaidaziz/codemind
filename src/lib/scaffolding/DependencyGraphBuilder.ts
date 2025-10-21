/**
 * DependencyGraphBuilder
 * 
 * Builds dependency graphs from generated files to visualize
 * file relationships and import/export connections.
 */

import type {
  GeneratedFile,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  NodeType,
} from './types';

export class DependencyGraphBuilder {
  /**
   * Build a dependency graph from generated files
   */
  build(files: GeneratedFile[]): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];

    // Create nodes for each file
    for (const file of files) {
      nodes.push({
        id: file.path,
        type: this.inferNodeType(file),
        label: this.getFileName(file.path),
        metadata: {
          language: file.language,
          template: file.template,
          isNew: file.isNew,
          exports: file.exports.length,
          imports: file.imports.length,
        },
      });
    }

    // Create edges based on imports
    for (const file of files) {
      for (const importStmt of file.imports) {
        // Resolve import path to actual file
        const targetPath = this.resolveImportPath(importStmt.from, file.path, files);
        if (targetPath) {
          edges.push({
            from: file.path,
            to: targetPath,
            type: 'imports',
          });
        }
      }
    }

    // Identify entry points (files with no dependencies)
    const entryPoints = nodes
      .filter(node => !edges.some(edge => edge.from === node.id))
      .map(node => node.id);

    // Calculate dependency layers
    const layers = this.calculateLayers(nodes, edges);

    return {
      nodes,
      edges,
      entryPoints,
      layers,
    };
  }

  /**
   * Detect circular dependencies in the graph
   */
  detectCircularDependencies(graph: DependencyGraph): string[][] {
    const circles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outgoingEdges = graph.edges.filter(e => e.from === nodeId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.to)) {
          dfs(edge.to, [...path]);
        } else if (recursionStack.has(edge.to)) {
          // Found a cycle
          const cycleStart = path.indexOf(edge.to);
          const cycle = [...path.slice(cycleStart), edge.to];
          circles.push(cycle);
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return circles;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private inferNodeType(file: GeneratedFile): NodeType {
    const path = file.path.toLowerCase();
    const filename = this.getFileName(path);

    // Infer from path patterns
    if (path.includes('/api/')) return 'route';
    if (path.includes('/components/')) return 'component';
    if (path.includes('/lib/') || path.includes('/utils/')) return 'utility';
    if (path.includes('/models/') || path.includes('/prisma/')) return 'model';
    if (path.includes('/services/')) return 'service';
    if (filename.includes('.test.') || filename.includes('.spec.')) return 'test';
    if (filename.includes('config') || filename === 'tsconfig.json') return 'config';
    if (path.includes('/types/') || filename.endsWith('.d.ts')) return 'type';

    // Infer from file exports
    const hasDefaultExport = file.exports.some(e => e.type === 'default');
    
    if (hasDefaultExport && (file.language === 'tsx' || file.language === 'jsx')) {
      return 'component';
    }

    return 'utility';
  }

  private getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  private resolveImportPath(
    importPath: string,
    fromFile: string,
    allFiles: GeneratedFile[]
  ): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const fromDir = fromFile.split('/').slice(0, -1).join('/');
      const resolved = this.resolvePath(fromDir, importPath);
      
      // Find matching file
      for (const file of allFiles) {
        if (file.path === resolved || file.path.startsWith(resolved)) {
          return file.path;
        }
      }
    }

    // Handle absolute imports (path aliases)
    if (importPath.startsWith('@/') || importPath.startsWith('src/')) {
      const normalizedPath = importPath.replace('@/', 'src/');
      
      for (const file of allFiles) {
        if (file.path.includes(normalizedPath)) {
          return file.path;
        }
      }
    }

    // External import (not in generated files)
    return null;
  }

  private resolvePath(basePath: string, relativePath: string): string {
    const parts = basePath.split('/').filter(p => p);
    const relParts = relativePath.split('/').filter(p => p);

    for (const part of relParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    return parts.join('/');
  }

  private calculateLayers(nodes: DependencyNode[], edges: DependencyEdge[]): string[][] {
    const layers: string[][] = [];
    const processed = new Set<string>();

    // Layer 0: Nodes with no dependencies
    let currentLayer = nodes
      .filter(node => !edges.some(edge => edge.from === node.id))
      .map(node => node.id);
    
    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      currentLayer.forEach(id => processed.add(id));

      // Next layer: Nodes whose dependencies are all processed
      currentLayer = nodes
        .filter(node => !processed.has(node.id))
        .filter(node => {
          const dependencies = edges
            .filter(edge => edge.from === node.id)
            .map(edge => edge.to);
          return dependencies.every(dep => processed.has(dep));
        })
        .map(node => node.id);
    }

    return layers;
  }

  /**
   * Export graph to DOT format for visualization
   */
  toDOT(graph: DependencyGraph): string {
    let dot = 'digraph DependencyGraph {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes
    for (const node of graph.nodes) {
      const color = this.getNodeColor(node.type);
      dot += `  "${node.id}" [label="${node.label}", fillcolor="${color}", style=filled];\n`;
    }

    dot += '\n';

    // Add edges
    for (const edge of graph.edges) {
      const style = edge.type === 'imports' ? 'solid' : 'dashed';
      dot += `  "${edge.from}" -> "${edge.to}" [style=${style}];\n`;
    }

    dot += '}\n';
    return dot;
  }

  private getNodeColor(type: NodeType): string {
    const colors: Record<NodeType, string> = {
      component: '#a8d5ff',
      route: '#ffb3ba',
      model: '#bae1ff',
      service: '#c9ffb3',
      utility: '#ffffb3',
      test: '#ffdfba',
      config: '#e0e0e0',
      type: '#d4b5ff',
    };

    return colors[type] || '#ffffff';
  }
}

// Singleton instance
let instance: DependencyGraphBuilder | null = null;

export function getDependencyGraphBuilder(): DependencyGraphBuilder {
  if (!instance) {
    instance = new DependencyGraphBuilder();
  }
  return instance;
}
