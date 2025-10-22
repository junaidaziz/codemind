'use client';

import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { InlineSpinner } from '@/components/ui';

interface CrossRepoLink {
  source: {
    owner: string;
    repo: string;
    number: number;
    type: 'issue' | 'pr';
    title: string;
    state: string;
  };
  target: {
    owner: string;
    repo: string;
    number: number;
    type: 'issue' | 'pr';
    title: string;
    state: string;
  };
  relationship: 'blocks' | 'blocked-by' | 'related-to' | 'duplicates' | 'fixes';
  discoveredAt: string;
}

interface WorkspaceLinks {
  totalLinks: number;
  crossRepoLinks: number;
  recentLinks: CrossRepoLink[];
}

interface CrossRepoLinksTabProps {
  workspaceId: string;
}

export default function CrossRepoLinksTab({ workspaceId }: CrossRepoLinksTabProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<WorkspaceLinks | null>(null);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [creating, setCreating] = useState(false);
  const [linkData, setLinkData] = useState<{
    sourceOwner: string;
    sourceRepo: string;
    sourceNumber: number;
    targetOwner: string;
    targetRepo: string;
    targetNumber: number;
    relationship: 'blocks' | 'blocked-by' | 'related-to' | 'duplicates' | 'fixes';
  }>({
    sourceOwner: '',
    sourceRepo: '',
    sourceNumber: 0,
    targetOwner: '',
    targetRepo: '',
    targetNumber: 0,
    relationship: 'related-to',
  });

  const fetchCrossRepoLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ state: 'all' });
      const data = await apiGet<WorkspaceLinks>(`/api/workspaces/${workspaceId}/cross-repo-links?${params}`);
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cross-repo links');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setError(null);
      await apiPost(`/api/workspaces/${workspaceId}/cross-repo-links`, {
        analysisType: 'create-link',
        source: {
          owner: linkData.sourceOwner,
          repo: linkData.sourceRepo,
          number: linkData.sourceNumber,
        },
        target: {
          owner: linkData.targetOwner,
          repo: linkData.targetRepo,
          number: linkData.targetNumber,
        },
        relationship: linkData.relationship,
      });
      setShowCreateLink(false);
      setLinkData({
        sourceOwner: '',
        sourceRepo: '',
        sourceNumber: 0,
        targetOwner: '',
        targetRepo: '',
        targetNumber: 0,
        relationship: 'related-to',
      });
      await fetchCrossRepoLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setCreating(false);
    }
  };

  const getRelationshipBadge = (relationship: string) => {
    const badges: Record<string, { color: string; emoji: string }> = {
      'blocks': { color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200', emoji: '🚫' },
      'blocked-by': { color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200', emoji: '⏸️' },
      'related-to': { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200', emoji: '🔗' },
      'duplicates': { color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200', emoji: '🔄' },
      'fixes': { color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200', emoji: '✅' },
    };
    const badge = badges[relationship] || badges['related-to'];
    return (
      <span className={`px-2 py-1 ${badge.color} text-xs font-medium rounded`}>
        {badge.emoji} {relationship}
      </span>
    );
  };

  if (loading && !links) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <InlineSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cross-Repository Links
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Track relationships between issues and PRs across repositories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateLink(true)}
            className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            + Create Link
          </button>
          <button
            onClick={fetchCrossRepoLinks}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? <InlineSpinner size="sm" /> : '🔄 Scan Links'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
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

      {/* Stats */}
      {links && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-3xl mb-2">🔗</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Links</div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {links.totalLinks}
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="text-3xl mb-2">🔀</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Cross-Repo Links</div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {links.crossRepoLinks}
              </div>
            </div>
          </div>

          {/* Links List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Recent Links ({links.recentLinks.length})
              </h4>
              {links.recentLinks.length === 0 ? (
                <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                  No cross-repo links found. Create one to get started!
                </p>
              ) : (
                <div className="space-y-4">
                  {links.recentLinks.map((link, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <a
                              href={`https://github.com/${link.source.owner}/${link.source.repo}/${link.source.type === 'issue' ? 'issues' : 'pull'}/${link.source.number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              {link.source.owner}/{link.source.repo}#{link.source.number}
                            </a>
                            <span className="text-gray-400">→</span>
                            {getRelationshipBadge(link.relationship)}
                            <span className="text-gray-400">→</span>
                            <a
                              href={`https://github.com/${link.target.owner}/${link.target.repo}/${link.target.type === 'issue' ? 'issues' : 'pull'}/${link.target.number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              {link.target.owner}/{link.target.repo}#{link.target.number}
                            </a>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <div>Source: {link.source.title}</div>
                            <div>Target: {link.target.title}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(link.discoveredAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          link.source.state === 'open'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          Source: {link.source.state}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          link.target.state === 'open'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          Target: {link.target.state}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!links && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="text-6xl mb-6">🔀</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            No Cross-Repo Links Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Scan your workspace to discover relationships between issues and PRs across repositories.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={fetchCrossRepoLinks}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Scan for Links
            </button>
            <button
              onClick={() => setShowCreateLink(true)}
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Manual Link
            </button>
          </div>
        </div>
      )}

      {/* Create Link Modal */}
      {showCreateLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Create Cross-Repo Link
              </h2>
              <form onSubmit={handleCreateLink}>
                <div className="space-y-6">
                  {/* Source */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Source (Issue/PR)</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Owner"
                        value={linkData.sourceOwner}
                        onChange={(e) => setLinkData({ ...linkData, sourceOwner: e.target.value })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Repo"
                        value={linkData.sourceRepo}
                        onChange={(e) => setLinkData({ ...linkData, sourceRepo: e.target.value })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Number"
                        value={linkData.sourceNumber || ''}
                        onChange={(e) => setLinkData({ ...linkData, sourceNumber: parseInt(e.target.value) || 0 })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        required
                      />
                    </div>
                  </div>

                  {/* Relationship */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Relationship Type
                    </label>
                    <select
                      value={linkData.relationship}
                      onChange={(e) => setLinkData({ ...linkData, relationship: e.target.value as 'blocks' | 'blocked-by' | 'related-to' | 'duplicates' | 'fixes' })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="related-to">🔗 Related To</option>
                      <option value="blocks">🚫 Blocks</option>
                      <option value="blocked-by">⏸️ Blocked By</option>
                      <option value="duplicates">🔄 Duplicates</option>
                      <option value="fixes">✅ Fixes</option>
                    </select>
                  </div>

                  {/* Target */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Target (Issue/PR)</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Owner"
                        value={linkData.targetOwner}
                        onChange={(e) => setLinkData({ ...linkData, targetOwner: e.target.value })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Repo"
                        value={linkData.targetRepo}
                        onChange={(e) => setLinkData({ ...linkData, targetRepo: e.target.value })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Number"
                        value={linkData.targetNumber || ''}
                        onChange={(e) => setLinkData({ ...linkData, targetNumber: parseInt(e.target.value) || 0 })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? <InlineSpinner /> : 'Create Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateLink(false);
                      setError(null);
                    }}
                    disabled={creating}
                    className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
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
  );
}
