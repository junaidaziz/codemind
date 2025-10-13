'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FullPageSpinner, ErrorBanner, InlineSpinner } from '../../components/ui';
import { ProtectedRoute } from '../components/ProtectedRoute';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createProjectData, setCreateProjectData] = useState({
    name: '',
    githubUrl: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      if (response.ok) {
        const apiResponse = await response.json();
        if (apiResponse.success) {
          setProjects(apiResponse.data);
          setError(null);
        } else {
          setError(apiResponse.error || 'Failed to fetch projects');
        }
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
        setError(null); // Clear any previous errors on success
      } else {
        const errorData = await response.json();
        setError(`Failed to reindex project: ${errorData.error || 'Unknown error'}`);
        // Refresh the projects list to get the updated error status
        await fetchProjects();
      }
    } catch (err) {
      setError('Error reindexing project');
      console.error('Error reindexing project:', err);
      // Refresh the projects list even on network errors
      await fetchProjects();
    } finally {
      // Always remove from reindexing set, regardless of success or failure
      setReindexingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    setProjectToDelete({ id: projectId, name: projectName });
    setShowDeleteModal(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchProjects(); // Refresh the list
        setShowDeleteModal(false);
        setProjectToDelete(null);
      } else {
        const errorData = await response.json();
        setError(`Failed to delete project: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Error deleting project');
      console.error('Error deleting project:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteProject = () => {
    setShowDeleteModal(false);
    setProjectToDelete(null);
  };

  const handleCreateProject = async () => {
    if (!createProjectData.name.trim() || !createProjectData.githubUrl.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createProjectData),
      });

      const apiResponse = await response.json();

      if (response.ok && apiResponse.success) {
        await fetchProjects(); // Refresh the list
        setShowCreateModal(false);
        setCreateProjectData({ name: '', githubUrl: '' });
        setError(null);
      } else {
        setError(apiResponse.error || 'Failed to create project');
      }
    } catch (err) {
      setError('Error creating project');
      console.error('Error creating project:', err);
    } finally {
      setIsCreating(false);
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

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Project is indexed and ready for chat interactions';
      case 'indexing':
        return 'Project is currently being indexed. This process analyzes your code structure and content for AI assistance';
      case 'error':
        return 'Indexing failed due to repository access issues, network errors, or unsupported file types';
      case 'idle':
      default:
        return 'Project has been created but not yet indexed';
    }
  };

  const getReindexButtonText = (project: Project) => {
    if (reindexingProjects.has(project.id) || project.status === 'indexing') {
      return 'Reindexing...';
    }
    
    if (project.lastIndexedAt) {
      return 'Re-index';
    }
    
    return 'Index Now';
  };

  const getReindexTooltip = (project: Project) => {
    if (project.lastIndexedAt) {
      return 'Re-index this project to update the AI knowledge base with recent code changes. This analyzes your repository structure, extracts code context, and prepares embeddings for intelligent chat responses.';
    }
    
    return 'Index this project for the first time to enable AI chat functionality. This process analyzes your code structure and prepares it for intelligent assistance.';
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">📁 Projects Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your indexed projects and monitor their status.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                + Create Project
              </button>
              <Link
                href="/"
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
          
          {/* Information Panel */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-blue-600 dark:text-blue-400 text-xl">💡</div>
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">About Project Indexing</h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                  Indexing analyzes your repository structure, extracts code context, and creates AI embeddings for intelligent chat responses. 
                  Projects must be indexed before you can chat with them. Re-index after significant code changes to keep the AI knowledge up-to-date.
                </p>
              </div>
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

        {/* Projects Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {projects.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">📂</div>
              <h3 className="text-xl font-semibold mb-2">No Projects Found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You haven&apos;t added any projects yet. Create your first project to get started!
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  + Create Project
                </button>
                <button
                  onClick={fetchProjects}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Refresh
                </button>
              </div>
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
                        <div className="flex items-center gap-2">
                          <span className={getStatusBadge(project.status)}>
                            {project.status}
                          </span>
                          <div className="group relative">
                            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                              {getStatusInfo(project.status)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(project.lastIndexedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/projects/${project.id}`}
                            className="px-3 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors text-xs"
                          >
                            View
                          </Link>
                          <Link
                            href={`/chat?project=${project.id}`}
                            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-xs"
                          >
                            Chat
                          </Link>
                          <div className="group relative">
                            <button
                              onClick={() => handleReindex(project.id)}
                              disabled={reindexingProjects.has(project.id) || project.status === 'indexing'}
                              className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                              title={getReindexTooltip(project)}
                            >
                              {reindexingProjects.has(project.id) || project.status === 'indexing' ? (
                                <InlineSpinner size="sm" color="white">
                                  Reindexing...
                                </InlineSpinner>
                              ) : (
                                getReindexButtonText(project)
                              )}
                            </button>
                            <div className="absolute right-0 top-8 w-80 p-3 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                              <strong>What is indexing?</strong>
                              <br />
                              {getReindexTooltip(project)}
                            </div>
                          </div>
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
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {projects.filter(p => p.status === 'error').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Indexing Errors</div>
                </div>
                <div className="group relative">
                  <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="absolute right-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    <strong>Indexing Errors</strong>
                    <br />
                    Projects that failed to index due to:
                    <br />• Repository access permissions
                    <br />• Network connectivity issues  
                    <br />• Unsupported file formats
                    <br />• Large repository size limits
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Project</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={createProjectData.name}
                  onChange={(e) => setCreateProjectData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Awesome Project"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
              </div>
              
              <div>
                <label htmlFor="github-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  GitHub URL *
                </label>
                <input
                  id="github-url"
                  type="url"
                  value={createProjectData.githubUrl}
                  onChange={(e) => setCreateProjectData(prev => ({ ...prev, githubUrl: e.target.value }))}
                  placeholder="https://github.com/username/repository"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter the GitHub repository URL to index your code
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateProjectData({ name: '', githubUrl: '' });
                  setError(null);
                }}
                disabled={isCreating}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={isCreating || !createProjectData.name.trim() || !createProjectData.githubUrl.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <InlineSpinner size="sm" color="white">
                    Creating...
                  </InlineSpinner>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDeleteProject}
        onConfirm={confirmDeleteProject}
        title="Delete Project"
        message={`Are you sure you want to delete "${projectToDelete?.name}"? This will permanently remove all project data, chat sessions, and messages. This action cannot be undone.`}
        confirmText="Delete Project"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
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