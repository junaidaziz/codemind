'use client';

import React, { useState, useEffect } from 'react';

interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  selected?: boolean;
  hasCoverage?: boolean;
  coveragePercent?: number;
}

interface TestPreview {
  filePath: string;
  testCode: string;
  testCount: number;
  framework: string;
}

interface GenerationStats {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  totalTests: number;
  duration: number;
}

interface Project {
  id: string;
  name: string;
}

export default function TestGenerationPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<'all' | 'untested' | 'low-coverage'>('untested');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewModal, setPreviewModal] = useState<TestPreview | null>(null);
  const [editedCode, setEditedCode] = useState('');
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setProjectsLoading(false);
    }
  };

  // Load file tree when project changes
  useEffect(() => {
    if (selectedProject) {
      loadFileTree();
    }
  }, [selectedProject, filterOption]);

  const loadFileTree = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Mock file tree data - replace with actual API call
      const mockTree: FileNode[] = [
        {
          path: 'src',
          name: 'src',
          type: 'directory',
          children: [
            {
              path: 'src/components',
              name: 'components',
              type: 'directory',
              children: [
                {
                  path: 'src/components/Button.tsx',
                  name: 'Button.tsx',
                  type: 'file',
                  hasCoverage: false,
                  coveragePercent: 0,
                },
                {
                  path: 'src/components/Card.tsx',
                  name: 'Card.tsx',
                  type: 'file',
                  hasCoverage: true,
                  coveragePercent: 45,
                },
              ],
            },
            {
              path: 'src/lib',
              name: 'lib',
              type: 'directory',
              children: [
                {
                  path: 'src/lib/utils.ts',
                  name: 'utils.ts',
                  type: 'file',
                  hasCoverage: true,
                  coveragePercent: 25,
                },
                {
                  path: 'src/lib/helpers.ts',
                  name: 'helpers.ts',
                  type: 'file',
                  hasCoverage: false,
                  coveragePercent: 0,
                },
              ],
            },
          ],
        },
      ];

      setFileTree(mockTree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const toggleFileSelection = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const selectAllFiles = (files: FileNode[]) => {
    const newSelected = new Set(selectedFiles);
    const addFiles = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'file') {
          newSelected.add(node.path);
        }
        if (node.children) {
          addFiles(node.children);
        }
      });
    };
    addFiles(files);
    setSelectedFiles(newSelected);
  };

  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  const generateTests = async (preview: boolean = false) => {
    if (selectedFiles.size === 0) {
      setError('Please select at least one file');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/testing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          files: Array.from(selectedFiles),
          options: {
            preview,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate tests');
      }

      if (preview && data.result?.generatedTests?.[0]) {
        // Show preview for first file
        const firstTest = data.result.generatedTests[0];
        setPreviewModal({
          filePath: firstTest.filePath,
          testCode: firstTest.testCode,
          testCount: firstTest.testCount || 0,
          framework: firstTest.framework || 'jest',
        });
        setEditedCode(firstTest.testCode);
      } else {
        // Generation complete
        setStats(data.stats);
        // Clear selections after successful generation
        setSelectedFiles(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const applyTests = async () => {
    if (!previewModal) return;

    setGenerating(true);
    try {
      const response = await fetch('/api/testing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          files: [previewModal.filePath],
          options: {
            customCode: editedCode,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply tests');
      }

      setPreviewModal(null);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply tests');
    } finally {
      setGenerating(false);
    }
  };

  const renderFileTree = (nodes: FileNode[], level: number = 0): React.ReactElement[] => {
    return nodes.map((node) => (
      <div key={node.path} style={{ marginLeft: `${level * 20}px` }}>
        {node.type === 'directory' ? (
          <div className="py-1">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span className="font-medium">{node.name}</span>
            </div>
            {node.children && renderFileTree(node.children, level + 1)}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedFiles.has(node.path)}
              onChange={() => toggleFileSelection(node.path)}
              className="rounded"
            />
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
            </svg>
            <span className="text-sm text-gray-600 dark:text-gray-400">{node.name}</span>
            {!node.hasCoverage && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">No tests</span>
            )}
            {node.hasCoverage && node.coveragePercent! < 50 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                {node.coveragePercent}% coverage
              </span>
            )}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Test Generation</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                AI-powered test generation for your codebase
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedFiles.size} files selected
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Selector Panel */}
          <div className="lg:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="space-y-4">
                {/* Project Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project
                  </label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={projectsLoading}
                  >
                    <option value="">Select a project...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <select
                    value={filterOption}
                    onChange={(e) => setFilterOption(e.target.value as 'all' | 'untested' | 'low-coverage')}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All Files</option>
                    <option value="untested">Untested Only</option>
                    <option value="low-coverage">Low Coverage (&lt;50%)</option>
                  </select>
                </div>

                {/* Selection Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => selectAllFiles(fileTree)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={deselectAllFiles}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Deselect All
                  </button>
                </div>

                {/* File Tree */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading files...</div>
                  ) : fileTree.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Select a project to view files
                    </div>
                  ) : (
                    renderFileTree(fileTree)
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Panel */}
          <div className="space-y-6">
            {/* Generation Options */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Generation Options
              </h3>
              <div className="space-y-4">
                <button
                  onClick={() => generateTests(true)}
                  disabled={generating || selectedFiles.size === 0}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {generating ? 'Generating...' : 'Preview Tests'}
                </button>
                <button
                  onClick={() => generateTests(false)}
                  disabled={generating || selectedFiles.size === 0}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {generating ? 'Generating...' : 'Generate & Apply'}
                </button>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Last Generation
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Files:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{stats.totalFiles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Success:</span>
                    <span className="font-medium text-green-600">{stats.successCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Failed:</span>
                    <span className="font-medium text-red-600">{stats.failureCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Tests Created:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{stats.totalTests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{stats.duration}s</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Test Preview
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {previewModal.filePath} • {previewModal.testCount} tests • {previewModal.framework}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewModal(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <textarea
                value={editedCode}
                onChange={(e) => setEditedCode(e.target.value)}
                className="w-full h-96 px-4 py-3 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                spellCheck={false}
              />
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setPreviewModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={applyTests}
                disabled={generating}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium"
              >
                {generating ? 'Applying...' : 'Apply Tests'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
