'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FullPageSpinner, ErrorBanner } from '../../../components/ui';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { GitHubIntegration } from '../../../components/GitHubIntegration';

interface Project {
  id: string;
  name: string;
  status: string;
  githubUrl: string;
  lastIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function ProjectDetailPageContent() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}`);
      
      if (response.ok) {
        const apiResponse = await response.json();
        if (apiResponse.success) {
          setProject(apiResponse.data);
          setError(null);
        } else {
          setError(apiResponse.error || 'Failed to fetch project');
        }
      } else {
        setError('Failed to fetch project details');
      }
    } catch (err) {
      setError('Error loading project');
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId, fetchProject]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium";
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

  if (loading) {
    return <FullPageSpinner text="Loading project details..." />;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="max-w-7xl mx-auto p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link
              href="/projects"
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              ← Back to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <nav className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                <Link href="/projects" className="hover:text-gray-700 dark:hover:text-gray-300">
                  Projects
                </Link>
                {' / '}
                <span className="text-gray-900 dark:text-white">{project.name}</span>
              </nav>
              <h1 className="text-3xl font-bold mb-2">📁 {project.name}</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your project settings, view GitHub integration, and monitor indexing status.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/chat?project=${project.id}`}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                💬 Chat
              </Link>
              <Link
                href="/projects"
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                ← Back
              </Link>
            </div>
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

        {/* Project Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-4">Project Overview</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={getStatusBadge(project.status)}>
                    {project.status}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Repository:</span>
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-mono"
                  >
                    {project.githubUrl.replace('https://github.com/', '')} ↗
                  </a>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Last Indexed:</span>
                  <span className="text-sm">{formatDate(project.lastIndexedAt)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="text-sm">{formatDate(project.createdAt)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Updated:</span>
                  <span className="text-sm">{formatDate(project.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <Link
                  href={`/chat?project=${project.id}`}
                  className="block w-full px-4 py-2 bg-blue-500 text-white text-center rounded-lg hover:bg-blue-600 transition-colors"
                >
                  💬 Start Chat
                </Link>
                
                <button
                  onClick={() => window.open(project.githubUrl, '_blank')}
                  className="block w-full px-4 py-2 bg-gray-500 text-white text-center rounded-lg hover:bg-gray-600 transition-colors"
                >
                  🔗 View on GitHub
                </button>
                
                <Link
                  href={`/projects/${project.id}/settings`}
                  className="block w-full px-4 py-2 bg-purple-500 text-white text-center rounded-lg hover:bg-purple-600 transition-colors"
                >
                  ⚙️ Settings
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* GitHub Integration Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <GitHubIntegration projectId={project.id} />
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <ProtectedRoute>
      <ProjectDetailPageContent />
    </ProtectedRoute>
  );
}