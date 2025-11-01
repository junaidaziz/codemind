'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { InlineSpinner, ErrorBanner } from '@/components/ui';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  repositories: Array<{
    owner: string;
    name: string;
    url: string;
    addedAt: string;
  }>;
  settings: {
    autoSync?: boolean;
    syncInterval?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface CreateWorkspaceData {
  name: string;
  description: string;
}

export default function WorkspacesClient() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [createData, setCreateData] = useState<CreateWorkspaceData>({
    name: '',
    description: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await apiGet<{ workspaces: Workspace[] }>('/api/workspaces');
      setWorkspaces(data.workspaces || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createData.name.trim()) {
      setError('Workspace name is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await apiPost('/api/workspaces', {
        name: createData.name.trim(),
        description: createData.description.trim() || undefined,
      });
      setShowCreateModal(false);
      setCreateData({ name: '', description: '' });
      await fetchWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete workspace "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(id);
      setError(null);
      await apiDelete(`/api/workspaces/${id}`);
      await fetchWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <InlineSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen app-root">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">
              🗂️ Workspaces
            </h1>
            <p className="text-secondary">
              Manage multi-repository workspaces for coordinated development
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-accent px-6 py-3"
          >
            + New Workspace
          </button>
        </div>

        {/* Search Bar */}
        {workspaces.length > 0 && (
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search workspaces by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-primary"
            />
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Workspaces Grid */}
        {workspaces.length === 0 ? (
          <div className="surface-card p-12 text-center">
            <div className="max-w-2xl mx-auto">
              <div className="text-6xl mb-6">📦</div>
              <h2 className="text-2xl font-bold text-primary mb-4">
                No Workspaces Yet
              </h2>
              <p className="text-secondary mb-8">
                Create your first workspace to start managing multiple repositories together.
                Workspaces help you coordinate development across related projects.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-accent px-8 py-3"
              >
                Create Your First Workspace
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces
              .filter((workspace) => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                  workspace.name.toLowerCase().includes(query) ||
                  workspace.description?.toLowerCase().includes(query)
                );
              })
              .map((workspace) => (
              <div
                key={workspace.id}
                className="surface-card hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-primary mb-2">
                        {workspace.name}
                      </h3>
                      {workspace.description && (
                        <p className="text-sm text-secondary line-clamp-2">
                          {workspace.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-4 text-sm text-secondary">
                    <div className="flex items-center gap-1">
                      <span>📁</span>
                      <span>{workspace.repositories?.length || 0} repos</span>
                    </div>
                    {workspace.settings?.autoSync && (
                      <div className="flex items-center gap-1">
                        <span>🔄</span>
                        <span>Auto-sync</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/workspaces/${workspace.id}`}
                      className="flex-1 btn-accent px-4 py-2 text-center"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => handleDelete(workspace.id, workspace.name)}
                      disabled={deleting === workspace.id}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting === workspace.id ? <InlineSpinner size="sm" /> : 'Delete'}
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-secondary">
                    Created {new Date(workspace.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="surface-card max-w-md w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-primary mb-4">
                  Create New Workspace
                </h2>
                <form onSubmit={handleCreate}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Workspace Name *
                      </label>
                      <input
                        type="text"
                        value={createData.name}
                        onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                        placeholder="My Awesome Workspace"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-primary"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Description
                      </label>
                      <textarea
                        value={createData.description}
                        onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                        placeholder="A workspace for managing related microservices..."
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-primary resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-6">
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 btn-accent px-6 py-3"
                    >
                      {creating ? <InlineSpinner /> : 'Create Workspace'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setCreateData({ name: '', description: '' });
                        setError(null);
                      }}
                      disabled={creating}
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-primary font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
