'use client';

import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { InlineSpinner } from '@/components/ui';

interface DependencyNode {
  id: string;
  name: string;
  version: string;
  repositoryId?: string;
  repositoryName?: string;
  type: 'repository' | 'npm' | 'maven' | 'pip' | 'gem' | 'cargo' | 'go';
  isDevDependency: boolean;
  isPeerDependency: boolean;
}

interface DependencyEdge {
  source: string;
  target: string;
  type: 'depends-on' | 'dev-depends-on' | 'peer-depends-on';
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  metadata: {
    workspaceId: string;
    repositoryCount: number;
    dependencyCount: number;
    generatedAt: string;
  };
}

interface DependenciesTabProps {
  workspaceId: string;
}

export default function DependenciesTab({ workspaceId }: DependenciesTabProps) {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  const [graphOptions, setGraphOptions] = useState({
    includeDevDeps: false,
    includePeerDeps: true,
    includeTransitive: false,
    maxDepth: 3,
  });

  const fetchDependencyGraph = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        includeDevDeps: graphOptions.includeDevDeps.toString(),
        includePeerDeps: graphOptions.includePeerDeps.toString(),
        includeTransitive: graphOptions.includeTransitive.toString(),
        maxDepth: graphOptions.maxDepth.toString(),
      });
      const data = await apiGet<DependencyGraph>(`/api/workspaces/${workspaceId}/dependencies?${params}`);
      setGraph(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dependency graph');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async (analysisType: string) => {
    try {
      setAnalyzing(true);
      setError(null);
      setActiveAnalysis(analysisType);
      const result = await apiPost(`/api/workspaces/${workspaceId}/dependencies/analyze`, {
        analysisType,
      });
      setAnalysis(result as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading && !graph) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <InlineSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Graph Options */}
      <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">
          Dependency Graph Options
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={graphOptions.includeDevDeps}
              onChange={(e) => setGraphOptions({ ...graphOptions, includeDevDeps: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-secondary">Include dev dependencies</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={graphOptions.includePeerDeps}
              onChange={(e) => setGraphOptions({ ...graphOptions, includePeerDeps: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-secondary">Include peer dependencies</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={graphOptions.includeTransitive}
              onChange={(e) => setGraphOptions({ ...graphOptions, includeTransitive: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-secondary">Include transitive dependencies</span>
          </label>
          <div>
            <label className="block text-sm text-secondary mb-1">Max Depth</label>
            <input
              type="number"
              min={1}
              max={10}
              value={graphOptions.maxDepth}
              onChange={(e) => setGraphOptions({ ...graphOptions, maxDepth: parseInt(e.target.value) || 3 })}
              className="w-24 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>
        <button
          onClick={fetchDependencyGraph}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <InlineSpinner size="sm" /> : '🔍 Build Dependency Graph'}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-red-950 dark:text-red-200">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Graph Summary */}
      {graph && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-3xl mb-2">📦</div>
              <div className="text-sm text-secondary mb-1">Total Dependencies</div>
              <div className="text-2xl font-semibold text-primary">
                {graph.nodes.length}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="text-3xl mb-2">🔗</div>
              <div className="text-sm text-secondary mb-1">Dependency Links</div>
              <div className="text-2xl font-semibold text-primary">
                {graph.edges.length}
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="text-3xl mb-2">📁</div>
              <div className="text-sm text-secondary mb-1">Repositories</div>
              <div className="text-2xl font-semibold text-primary">
                {graph.metadata.repositoryCount}
              </div>
            </div>
          </div>

          {/* Analysis Actions */}
          <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-primary mb-4">
              Run Analysis
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => runAnalysis('cycles')}
                disabled={analyzing}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                🔄 Detect Cycles
              </button>
              <button
                onClick={() => runAnalysis('duplicates')}
                disabled={analyzing}
                className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
              >
                📋 Find Duplicates
              </button>
              <button
                onClick={() => runAnalysis('metrics')}
                disabled={analyzing}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                📊 Metrics
              </button>
              <button
                onClick={() => runAnalysis('summary')}
                disabled={analyzing}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                📝 Summary
              </button>
            </div>
          </div>

          {/* Analysis Results */}
          {analyzing && (
            <div className="flex items-center justify-center py-8">
              <InlineSpinner />
            </div>
          )}

          {analysis && !analyzing && (
            <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-primary mb-4">
                Analysis Results: {activeAnalysis}
              </h3>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(analysis, null, 2)}
              </pre>
            </div>
          )}

          {/* Dependency List */}
          <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-primary mb-4">
              Dependencies ({graph.nodes.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {graph.nodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-primary">
                      {node.name}
                    </div>
                    <div className="text-sm text-secondary">
                      {node.version} • {node.type}
                      {node.repositoryName && ` • ${node.repositoryName}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {node.isDevDependency && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium rounded">
                        Dev
                      </span>
                    )}
                    {node.isPeerDependency && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs font-medium rounded">
                        Peer
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!graph && !loading && (
        <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="text-6xl mb-6">🔗</div>
          <h3 className="text-xl font-semibold text-primary mb-4">
            No Dependency Graph Yet
          </h3>
          <p className="text-secondary mb-6">
            Build a dependency graph to visualize and analyze dependencies across your repositories.
          </p>
          <button
            onClick={fetchDependencyGraph}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Build Dependency Graph
          </button>
        </div>
      )}
    </div>
  );
}
