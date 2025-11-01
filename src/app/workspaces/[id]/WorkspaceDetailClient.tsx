'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { InlineSpinner } from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import DependenciesTab from './DependenciesTab';
import CrossRepoLinksTab from './CrossRepoLinksTab';
import GitHubActionsTab from './GitHubActionsTab';
import BranchPolicyTab from './BranchPolicyTab';
import InsightsTab from './InsightsTab';

interface Repository {
  fullName: string; // e.g., "owner/repo"
  owner: string;
  name: string;
  url: string;
  addedAt?: string;
  lastSyncedAt?: string;
  private?: boolean;
  defaultBranch?: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  repositories: string[]; // Array of "owner/repo" strings from backend
  settings: {
    autoSync?: boolean;
    syncInterval?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceDetailClientProps {
  workspaceId: string;
}

type Tab = 'repositories' | 'dependencies' | 'cross-repo-links' | 'github-actions' | 'branch-policy' | 'settings' | 'insights';

export default function WorkspaceDetailClient({ workspaceId }: WorkspaceDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('repositories');
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [showEditWorkspace, setShowEditWorkspace] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [bulkRepoUrls, setBulkRepoUrls] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [editData, setEditData] = useState({ name: '', description: '' });
  const [settingsData, setSettingsData] = useState({
    autoSync: false,
    syncInterval: 60,
  });
  const [editingRepo, setEditingRepo] = useState<{ owner: string; name: string } | null>(null);
  const [editRepoUrl, setEditRepoUrl] = useState('');

  const fetchWorkspace = async () => {
    try {
      setLoading(true);
      const data = await apiGet<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`);
      setWorkspace(data.workspace);
      setEditData({
        name: data.workspace.name,
        description: data.workspace.description || '',
      });
      setSettingsData({
        autoSync: data.workspace.settings?.autoSync || false,
        syncInterval: data.workspace.settings?.syncInterval || 60,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setError('Repository URL is required');
      return;
    }

    try {
      setAdding(true);
      setError(null);

      // Parse GitHub URL (supports https://github.com/owner/repo or owner/repo format)
      let owner = '';
      let name = '';

      if (repoUrl.includes('github.com')) {
        const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
          owner = match[1];
          name = match[2].replace('.git', '');
        }
      } else if (repoUrl.includes('/')) {
        [owner, name] = repoUrl.split('/');
      }

      if (!owner || !name) {
        setError('Invalid repository URL. Use format: owner/repo or https://github.com/owner/repo');
        return;
      }

      await apiPost(`/api/workspaces/${workspaceId}/repositories`, {
        action: 'add',
        owner: owner.trim(),
        name: name.trim(),
      });

      setShowAddRepo(false);
      setRepoUrl('');
      await fetchWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setAdding(false);
    }
  };

  const handleBulkAddRepositories = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkRepoUrls.trim()) {
      setError('At least one repository URL is required');
      return;
    }

    try {
      setAdding(true);
      setError(null);

      // Split by newlines and parse each URL
      const urls = bulkRepoUrls.split('\n').filter(url => url.trim());
      const repos: Array<{ owner: string; name: string }> = [];

      for (const url of urls) {
        let owner = '';
        let name = '';

        if (url.includes('github.com')) {
          const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
          if (match) {
            owner = match[1];
            name = match[2].replace('.git', '');
          }
        } else if (url.includes('/')) {
          [owner, name] = url.split('/');
        }

        if (owner && name) {
          repos.push({ owner: owner.trim(), name: name.trim() });
        }
      }

      if (repos.length === 0) {
        setError('No valid repository URLs found. Use format: owner/repo or https://github.com/owner/repo');
        return;
      }

      // Add repositories sequentially
      for (const repo of repos) {
        await apiPost(`/api/workspaces/${workspaceId}/repositories`, {
          action: 'add',
          owner: repo.owner,
          name: repo.name,
        });
      }

      setShowBulkAdd(false);
      setBulkRepoUrls('');
      await fetchWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repositories');
    } finally {
      setAdding(false);
    }
  };

  const handleSyncRepository = async (owner: string, name: string) => {
    try {
      const repoId = `${owner}/${name}`;
      setSyncing(repoId);
      setError(null);
      await apiPost(`/api/workspaces/${workspaceId}/repositories`, {
        action: 'sync',
        owner,
        name,
      });
      // Show success toast instead of reloading entire workspace
      toast({
        title: 'Repository synced',
        description: `${owner}/${name} has been synced successfully`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync repository');
      toast({
        title: 'Sync failed',
        description: err instanceof Error ? err.message : 'Failed to sync repository',
        variant: 'destructive',
      });
    } finally {
      setSyncing(null);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      setUpdatingSettings(true);
      setError(null);
      await apiPut(`/api/workspaces/${workspaceId}`, {
        settings: {
          autoSync: settingsData.autoSync,
          syncInterval: settingsData.syncInterval,
        },
      });
      await fetchWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleRemoveRepository = async (owner: string, name: string) => {
    if (!confirm(`Remove ${owner}/${name} from this workspace?`)) {
      return;
    }

    try {
      const repoId = `${owner}/${name}`;
      setRemoving(repoId);
      setError(null);
      await apiPost(`/api/workspaces/${workspaceId}/repositories`, {
        action: 'remove',
        owner,
        name,
      });
      await fetchWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove repository');
    } finally {
      setRemoving(null);
    }
  };

  const handleEditRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRepoUrl.trim() || !editingRepo) {
      setError('Repository URL is required');
      return;
    }

    try {
      setUpdating(true);
      setError(null);

      // Parse new GitHub URL
      let newOwner = '';
      let newName = '';

      if (editRepoUrl.includes('github.com')) {
        const match = editRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
          newOwner = match[1];
          newName = match[2].replace('.git', '');
        }
      } else if (editRepoUrl.includes('/')) {
        [newOwner, newName] = editRepoUrl.split('/');
      }

      if (!newOwner || !newName) {
        setError('Invalid repository URL. Use format: owner/repo or https://github.com/owner/repo');
        return;
      }

      // Remove old repository
      await apiPost(`/api/workspaces/${workspaceId}/repositories`, {
        action: 'remove',
        owner: editingRepo.owner,
        name: editingRepo.name,
      });

      // Add new repository
      await apiPost(`/api/workspaces/${workspaceId}/repositories`, {
        action: 'add',
        owner: newOwner.trim(),
        name: newName.trim(),
      });

      setEditingRepo(null);
      setEditRepoUrl('');
      await fetchWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update repository');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Recently';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Recently';
      return date.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  const parseRepository = (repoString: string): Repository => {
    const [owner, name] = repoString.split('/');
    return {
      fullName: repoString,
      owner: owner || 'unknown',
      name: name || 'unknown',
      url: `https://github.com/${repoString}`,
      addedAt: undefined,
      lastSyncedAt: undefined,
      private: false,
      defaultBranch: 'main',
    };
  };

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData.name.trim()) {
      setError('Workspace name is required');
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      await apiPut(`/api/workspaces/${workspaceId}`, {
        name: editData.name.trim(),
        description: editData.description.trim() || undefined,
      });
      setShowEditWorkspace(false);
      await fetchWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workspace');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace) return;
    if (!confirm(`Are you sure you want to delete workspace "${workspace.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await apiDelete(`/api/workspaces/${workspaceId}`);
      router.push('/workspaces');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <InlineSpinner />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen app-root py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
            <p className="text-red-800 dark:text-red-200 mb-4">Workspace not found</p>
            <Link
              href="/workspaces"
              className="btn-accent px-6 py-3 inline-block"
            >
              Back to Workspaces
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-root">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/workspaces"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              ← Back to Workspaces
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">
                {workspace.name}
              </h1>
              {workspace.description && (
                <p className="text-secondary">
                  {workspace.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowEditWorkspace(true)}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDeleteWorkspace}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
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

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('repositories')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'repositories'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              📁 Repositories ({workspace.repositories?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('dependencies')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dependencies'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              🔗 Dependencies
            </button>
            <button
              onClick={() => setActiveTab('cross-repo-links')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'cross-repo-links'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              🔀 Cross-Repo Links
            </button>
            <button
              onClick={() => setActiveTab('github-actions')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'github-actions'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              🔄 GitHub Actions
            </button>
            <button
              onClick={() => setActiveTab('branch-policy')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'branch-policy'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              🛡️ Branch Policy
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'insights'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              📊 Insights
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'repositories' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkAdd(true)}
                  className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  + Bulk Add
                </button>
                <button
                  onClick={() => setShowAddRepo(true)}
                  className="btn-accent px-4 py-2 whitespace-nowrap"
                >
                  + Add Repository
                </button>
              </div>
            </div>

            {workspace.repositories?.length === 0 ? (
              <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <div className="text-6xl mb-6">📦</div>
                <h3 className="text-xl font-semibold text-primary mb-4">
                  No Repositories Yet
                </h3>
                <p className="text-secondary mb-6">
                  Add your first repository to start managing them together in this workspace.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowAddRepo(true)}
                    className="btn-accent px-6 py-3"
                  >
                    Add Repository
                  </button>
                  <button
                    onClick={() => setShowBulkAdd(true)}
                    className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Bulk Add Repositories
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {workspace.repositories
                  .map(parseRepository)
                  .filter((repo) => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      repo.name.toLowerCase().includes(query) ||
                      repo.owner.toLowerCase().includes(query) ||
                      repo.fullName.toLowerCase().includes(query)
                    );
                  })
                  .map((repo) => (
                    <div
                      key={repo.fullName}
                      className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <a
                              href={repo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {repo.owner}/{repo.name}
                            </a>
                            {repo.private && (
                              <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-medium rounded">
                                Private
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            {repo.defaultBranch && (
                              <div className="flex items-center gap-1">
                                <span>🌿</span>
                                <span>{repo.defaultBranch}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span>📅</span>
                              <span>Added {formatDate(repo.addedAt)}</span>
                            </div>
                            {repo.lastSyncedAt && (
                              <div className="flex items-center gap-1">
                                <span>🔄</span>
                                <span>Synced {formatDate(repo.lastSyncedAt)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingRepo({ owner: repo.owner, name: repo.name });
                              setEditRepoUrl(repo.fullName);
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleSyncRepository(repo.owner, repo.name)}
                            disabled={syncing === repo.fullName}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {syncing === repo.fullName ? <InlineSpinner size="sm" /> : '🔄 Sync'}
                          </button>
                          <button
                            onClick={() => handleRemoveRepository(repo.owner, repo.name)}
                            disabled={removing === repo.fullName}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {removing === repo.fullName ? <InlineSpinner size="sm" /> : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'dependencies' && (
          <DependenciesTab workspaceId={workspaceId} />
        )}

        {activeTab === 'cross-repo-links' && (
          <CrossRepoLinksTab workspaceId={workspaceId} />
        )}

        {activeTab === 'github-actions' && (
          <GitHubActionsTab workspaceId={workspaceId} />
        )}

        {activeTab === 'branch-policy' && (
          <BranchPolicyTab workspaceId={workspaceId} />
        )}

        {activeTab === 'settings' && (
          <div className="surface-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-primary">
                Workspace Settings
              </h2>
              <button
                onClick={handleUpdateSettings}
                disabled={updatingSettings}
                className="btn-accent px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingSettings ? <InlineSpinner size="sm" /> : 'Save Settings'}
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsData.autoSync}
                    onChange={(e) => {
                      setSettingsData({ ...settingsData, autoSync: e.target.checked });
                    }}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-primary">Auto-sync repositories</div>
                    <div className="text-sm text-secondary">
                      Automatically sync repository data at regular intervals
                    </div>
                  </div>
                </label>
              </div>
              {settingsData.autoSync && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Sync Interval (minutes)
                  </label>
                  <input
                    type="number"
                    value={settingsData.syncInterval}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 60;
                      setSettingsData({ ...settingsData, syncInterval: Math.max(5, Math.min(1440, value)) });
                    }}
                    min={5}
                    max={1440}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-primary"
                  />
                  <p className="text-sm text-secondary mt-2">
                    How often to sync repository data (5-1440 minutes)
                  </p>
                </div>
              )}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-primary mb-3">Sync Information</h3>
                <div className="space-y-2 text-sm text-secondary">
                  <p>• Repository data includes metadata, branches, commits, and contributors</p>
                  <p>• Auto-sync helps keep your workspace up-to-date with GitHub changes</p>
                  <p>• Manual sync is always available via the repository list</p>
                  <p>• Lower intervals mean more API calls to GitHub</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <InsightsTab workspaceId={workspaceId} repositories={workspace.repositories} />
        )}

        {/* Add Repository Modal */}
        {showAddRepo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="surface-card rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-primary mb-4">
                  Add Repository
                </h2>
                <form onSubmit={handleAddRepository}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-primary mb-2">
                      Repository URL or Owner/Name *
                    </label>
                    <input
                      type="text"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="owner/repo or https://github.com/owner/repo"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-primary"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={adding}
                      className="btn-accent flex-1 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {adding ? <InlineSpinner /> : 'Add Repository'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddRepo(false);
                        setRepoUrl('');
                        setError(null);
                      }}
                      disabled={adding}
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Add Repositories Modal */}
        {showBulkAdd && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="surface-card rounded-lg shadow-xl max-w-2xl w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-primary mb-4">
                  Bulk Add Repositories
                </h2>
                <form onSubmit={handleBulkAddRepositories}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-primary mb-2">
                      Repository URLs (one per line) *
                    </label>
                    <textarea
                      value={bulkRepoUrls}
                      onChange={(e) => setBulkRepoUrls(e.target.value)}
                      placeholder="owner/repo&#10;https://github.com/owner/another-repo&#10;owner/third-repo"
                      rows={10}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-primary resize-none font-mono text-sm"
                      required
                      autoFocus
                    />
                    <p className="text-sm text-secondary mt-2">
                      Each line can be in format: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">owner/repo</code> or full GitHub URL
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={adding}
                      className="flex-1 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {adding ? <InlineSpinner /> : 'Add All Repositories'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkAdd(false);
                        setBulkRepoUrls('');
                        setError(null);
                      }}
                      disabled={adding}
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

        {/* Edit Repository Modal */}
        {editingRepo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="surface-card rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-primary mb-4">
                  Edit Repository
                </h2>
                <p className="text-sm text-secondary mb-4">
                  Currently: <strong>{editingRepo.owner}/{editingRepo.name}</strong>
                </p>
                <form onSubmit={handleEditRepository}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-primary mb-2">
                      New Repository URL or Owner/Name *
                    </label>
                    <input
                      type="text"
                      value={editRepoUrl}
                      onChange={(e) => setEditRepoUrl(e.target.value)}
                      placeholder="owner/repo or https://github.com/owner/repo"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-primary"
                      required
                      autoFocus
                    />
                    <p className="text-sm text-secondary mt-2">
                      ⚠️ This will remove the current repository and add the new one
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={updating}
                      className="btn-accent flex-1 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating ? <InlineSpinner /> : 'Update Repository'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRepo(null);
                        setEditRepoUrl('');
                        setError(null);
                      }}
                      disabled={updating}
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Workspace Modal */}
        {showEditWorkspace && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="surface-card rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-primary mb-4">
                  Edit Workspace
                </h2>
                <form onSubmit={handleUpdateWorkspace}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Workspace Name *
                      </label>
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
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
                        value={editData.description}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        placeholder="A workspace for managing related microservices..."
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-primary resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-6">
                    <button
                      type="submit"
                      disabled={updating}
                      className="btn-accent flex-1 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating ? <InlineSpinner /> : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditWorkspace(false);
                        setEditData({
                          name: workspace.name,
                          description: workspace.description || '',
                        });
                        setError(null);
                      }}
                      disabled={updating}
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
