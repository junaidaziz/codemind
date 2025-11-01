'use client';

import React, { useState, useEffect } from 'react';

interface Snapshot {
  path: string;
  testFile: string;
  name: string;
  size: number;
  lastModified: string;
  status: 'current' | 'obsolete' | 'changed';
}

interface SnapshotAPIResponse {
  path?: string;
  testFile?: string;
  name?: string;
  size?: number;
  lastModified?: string;
  status?: 'current' | 'obsolete' | 'changed';
}

interface SnapshotChange {
  testFile: string;
  snapshotName: string;
  expectedPath: string;
  receivedPath: string;
  diff?: string;
  suggestion?: string;
}

interface AnalysisResult {
  totalSnapshots: number;
  obsoleteSnapshots: number;
  changedSnapshots: number;
  totalSize: number;
}

export default function SnapshotManagerPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [filteredSnapshots, setFilteredSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshots, setSelectedSnapshots] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'current' | 'obsolete' | 'changed'>('all');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedChange, setSelectedChange] = useState<SnapshotChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'changes'>('list');
  const [changes, setChanges] = useState<SnapshotChange[]>([]);

  useEffect(() => {
    loadSnapshots();
    loadAnalysis();
  }, []);

  useEffect(() => {
    let filtered = snapshots;

    if (searchQuery) {
      filtered = filtered.filter(
        (snap) =>
          snap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          snap.testFile.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((snap) => snap.status === filterStatus);
    }

    setFilteredSnapshots(filtered);
  }, [snapshots, searchQuery, filterStatus]);

  const loadSnapshots = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/testing/snapshots?action=list');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load snapshots');
      }

      // Transform API data to component format
      const transformedSnapshots: Snapshot[] = (data.snapshots || []).map((snap: SnapshotAPIResponse | string) => {
        if (typeof snap === 'string') {
          return {
            path: snap,
            testFile: 'Unknown',
            name: snap.split('/').pop() || snap,
            size: 0,
            lastModified: new Date().toISOString(),
            status: 'current' as const,
          };
        }
        return {
          path: snap.path || '',
          testFile: snap.testFile || 'Unknown',
          name: snap.name || snap.path?.split('/').pop() || '',
          size: snap.size || 0,
          lastModified: snap.lastModified || new Date().toISOString(),
          status: snap.status || 'current',
        };
      });

      setSnapshots(transformedSnapshots);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysis = async () => {
    try {
      const response = await fetch('/api/testing/snapshots?action=analyze');
      const data = await response.json();

      if (response.ok && data.analysis) {
        setAnalysis({
          totalSnapshots: data.analysis.totalSnapshots || 0,
          obsoleteSnapshots: data.analysis.obsoleteSnapshots?.length || 0,
          changedSnapshots: data.analysis.changedSnapshots?.length || 0,
          totalSize: data.analysis.totalSize || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load analysis:', err);
    }
  };

  const loadChanges = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/testing/snapshots?action=changes');
      const data = await response.json();

      if (response.ok) {
        setChanges(data.changes || []);
        setViewMode('changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load changes');
    } finally {
      setLoading(false);
    }
  };

  const toggleSnapshot = (path: string) => {
    const newSelected = new Set(selectedSnapshots);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedSnapshots(newSelected);
  };

  const selectAll = () => {
    setSelectedSnapshots(new Set(filteredSnapshots.map((s) => s.path)));
  };

  const deselectAll = () => {
    setSelectedSnapshots(new Set());
  };

  const updateSnapshots = async (updateAll: boolean = false) => {
    setUpdating(true);
    setError(null);

    try {
      const response = await fetch('/api/testing/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          updateAll,
          testPattern: updateAll ? undefined : Array.from(selectedSnapshots).join(','),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update snapshots');
      }

      // Reload snapshots after update
      await loadSnapshots();
      await loadAnalysis();
      setSelectedSnapshots(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const viewDiff = (change: SnapshotChange) => {
    setSelectedChange(change);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Snapshot Manager</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage and review test snapshots
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                List View
              </button>
              <button
                onClick={loadChanges}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'changes'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analysis Stats */}
        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Snapshots</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysis.totalSnapshots}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Obsolete</div>
              <div className="text-2xl font-bold text-red-600">
                {analysis.obsoleteSnapshots}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Changed</div>
              <div className="text-2xl font-bold text-yellow-600">
                {analysis.changedSnapshots}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Size</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBytes(analysis.totalSize)}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'list' ? (
          <>
            {/* Controls */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="space-y-4">
                {/* Search and Filter */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Search snapshots..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All Status</option>
                    <option value="current">Current</option>
                    <option value="obsolete">Obsolete</option>
                    <option value="changed">Changed</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      Select All
                    </button>
                    <span className="text-gray-400">|</span>
                    <button onClick={deselectAll} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      Deselect All
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">
                      {selectedSnapshots.size} selected
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateSnapshots(false)}
                      disabled={updating || selectedSnapshots.size === 0}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                    >
                      {updating ? 'Updating...' : 'Update Selected'}
                    </button>
                    <button
                      onClick={() => updateSnapshots(true)}
                      disabled={updating}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                    >
                      {updating ? 'Updating...' : 'Update All'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Snapshot List */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
                          className="rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Snapshot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Test File
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Modified
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          Loading snapshots...
                        </td>
                      </tr>
                    ) : filteredSnapshots.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          No snapshots found
                        </td>
                      </tr>
                    ) : (
                      filteredSnapshots.map((snapshot) => (
                        <tr key={snapshot.path} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedSnapshots.has(snapshot.path)}
                              onChange={() => toggleSnapshot(snapshot.path)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {snapshot.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {snapshot.path}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {snapshot.testFile}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                snapshot.status === 'current'
                                  ? 'bg-green-100 text-green-800'
                                  : snapshot.status === 'obsolete'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {snapshot.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {formatBytes(snapshot.size)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {new Date(snapshot.lastModified).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* Changes View */
          <div className="space-y-4">
            {changes.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="text-gray-500 dark:text-gray-400">No snapshot changes detected</div>
              </div>
            ) : (
              changes.map((change, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {change.snapshotName}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{change.testFile}</p>
                    </div>
                    <button
                      onClick={() => viewDiff(change)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                    >
                      View Diff
                    </button>
                  </div>
                  {change.suggestion && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>AI Suggestion:</strong> {change.suggestion}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Diff Modal */}
      {selectedChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Snapshot Diff
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedChange.testFile} → {selectedChange.snapshotName}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedChange(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Expected
                  </h3>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                    {selectedChange.expectedPath || 'No expected snapshot'}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Received
                  </h3>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                    {selectedChange.receivedPath || 'No received snapshot'}
                  </pre>
                </div>
              </div>
              {selectedChange.diff && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Diff
                  </h3>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                    {selectedChange.diff}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setSelectedChange(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => {
                  updateSnapshots(false);
                  setSelectedChange(null);
                }}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                Accept Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
