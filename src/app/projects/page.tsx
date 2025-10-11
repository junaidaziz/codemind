'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FullPageSpinner, ErrorBanner, InlineSpinner } from '../../components/ui';
import { ProtectedRoute } from '../components/ProtectedRoute';

interface Project {
  id: string;
  name: string;
  status: string;
  lastIndexedAt: string | null;
}

function ProjectsPageContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [reindexingProjects, setReindexingProjects] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        setError(null);
      } else {
        setError('Failed to fetch projects');
      }
    } catch (err) {
      setError('Error loading projects');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async (projectId: string) => {
    try {
      setReindexingProjects(prev => new Set(prev).add(projectId));
      
      const response = await fetch(`/api/projects/${projectId}/index`, {
        method: 'POST',
      });

      if (response.ok) {
        // Refresh the projects list to get updated status
        await fetchProjects();
      } else {
        const errorData = await response.json();
        setError(`Failed to reindex project: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Error reindexing project');
      console.error('Error reindexing project:', err);
    } finally {
      setReindexingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete "${projectName}"? This will permanently remove all project data, chat sessions, and messages.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchProjects(); // Refresh the list
      } else {
        const errorData = await response.json();
        setError(`Failed to delete project: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Error deleting project');
      console.error('Error deleting project:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'ready':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case 'indexing':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case 'idle':
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300`;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <FullPageSpinner text="Loading projects..." />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">📁 Projects Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your indexed projects and monitor their status.
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <ErrorBanner
            message={error}
            type="error"
            onDismiss={() => setError(null)}
            className="mb-6"
          />
        )}

        {/* Projects Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {projects.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">📂</div>
              <h3 className="text-xl font-semibold mb-2">No Projects Found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You haven&apos;t added any projects yet. Create your first project to get started!
              </p>
              <button
                onClick={fetchProjects}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Project Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Last Indexed
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium">{project.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{project.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(project.status)}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(project.lastIndexedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/chat?project=${project.id}`}
                            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-xs"
                          >
                            Chat
                          </Link>
                          <button
                            onClick={() => handleReindex(project.id)}
                            disabled={reindexingProjects.has(project.id) || project.status === 'indexing'}
                            className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                          >
                            {reindexingProjects.has(project.id) || project.status === 'indexing' ? (
                              <InlineSpinner size="sm" color="white">
                                Reindexing...
                              </InlineSpinner>
                            ) : (
                              'Reindex'
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id, project.name)}
                            className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        {projects.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {projects.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Projects</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {projects.filter(p => p.status === 'ready').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Ready</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {projects.filter(p => p.status === 'indexing').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Indexing</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {projects.filter(p => p.status === 'error').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Errors</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <ProjectsPageContent />
    </ProtectedRoute>
  );
}