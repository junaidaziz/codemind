// GitHub webhook management components for CodeMind
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Spinner } from './ui';
import ConfirmationModal from './ui/ConfirmationModal';

// Types for webhook management
interface WebhookConfig {
  id: string;
  projectId: string;
  repositoryUrl: string;
  repositoryName?: string;
  events: string[];
  active: boolean;
  webhookUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface WebhookLog {
  id: string;
  eventType: string;
  eventAction: string;
  processed: boolean;
  success: boolean;
  error: string | null;
  description: string;
  createdAt: string;
}

interface WebhookStats {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
}

interface WebhookData {
  webhook: WebhookConfig;
  logs: WebhookLog[];
  stats: WebhookStats;
}

interface GitHubWebhookManagerProps {
  projectId: string;
  className?: string;
}

// Available GitHub events
const GITHUB_EVENTS = [
  { id: 'push', label: 'Push', description: 'Code pushed to repository' },
  { id: 'pull_request', label: 'Pull Request', description: 'Pull request opened, closed, or updated' },
  { id: 'issues', label: 'Issues', description: 'Issues opened, closed, or updated' },
  { id: 'release', label: 'Release', description: 'Release published or updated' },
  { id: 'issue_comment', label: 'Issue Comment', description: 'Comments on issues or pull requests' },
  { id: 'pull_request_review', label: 'PR Review', description: 'Pull request reviews' },
  { id: 'create', label: 'Create', description: 'Branch or tag created' },
  { id: 'delete', label: 'Delete', description: 'Branch or tag deleted' },
];

/**
 * Main GitHub webhook management component
 */
export const GitHubWebhookManager: React.FC<GitHubWebhookManagerProps> = ({
  projectId,
  className = '',
}) => {
  const [webhookData, setWebhookData] = useState<WebhookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadWebhookData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/github/webhooks?projectId=${projectId}`);
      const result = await response.json();

      if (result.success) {
        setWebhookData(result.data);
      } else {
        setError(result.error || 'Failed to load webhook data');
      }
    } catch (err) {
      setError('Failed to load webhook data');
      console.error('Webhook data loading error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load webhook configuration
  useEffect(() => {
    loadWebhookData();
  }, [loadWebhookData]);

  const handleWebhookSave = async (config: { repositoryUrl: string; events: string[] }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/github/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          ...config,
        }),
      });

      const result = await response.json();

      if (result.success) {
        await loadWebhookData(); // Reload data
        setShowSetupForm(false);
      } else {
        setError(result.error || 'Failed to save webhook configuration');
      }
    } catch (err) {
      setError('Failed to save webhook configuration');
      console.error('Webhook save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWebhookDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmWebhookDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      const response = await fetch(`/api/github/webhooks?projectId=${projectId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setWebhookData(null);
        setShowSetupForm(true);
        setShowDeleteModal(false);
      } else {
        setError(result.error || 'Failed to delete webhook');
      }
    } catch (err) {
      setError('Failed to delete webhook');
      console.error('Webhook delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelWebhookDelete = () => {
    setShowDeleteModal(false);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Spinner />
        <span className="ml-2">Loading webhook configuration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <span className="text-red-600 text-xl mr-2">⚠️</span>
          <div>
            <h3 className="text-red-800 font-medium">Error Loading Webhooks</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadWebhookData}
          className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">GitHub Webhooks</h2>
          <p className="text-sm text-gray-600">
            Automatically sync your repository changes with CodeMind
          </p>
        </div>
        
        {webhookData && !showSetupForm && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowSetupForm(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Configure
            </button>
            <button
              onClick={handleWebhookDelete}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Webhook Configuration or Setup Form */}
      {!webhookData || showSetupForm ? (
        <WebhookSetupForm
          initialData={webhookData?.webhook}
          onSave={handleWebhookSave}
          onCancel={() => setShowSetupForm(false)}
          loading={loading}
        />
      ) : (
        <>
          <WebhookConfigCard webhook={webhookData.webhook} />
          <WebhookStats stats={webhookData.stats} />
          <WebhookLogsList logs={webhookData.logs} />
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelWebhookDelete}
        onConfirm={confirmWebhookDelete}
        title="Delete Webhook Configuration"
        message="Are you sure you want to delete this webhook configuration? This will stop all webhook events from being processed for this project. You can always set up a new webhook later."
        confirmText="Delete Webhook"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

/**
 * Webhook setup form component
 */
interface WebhookSetupFormProps {
  initialData?: WebhookConfig;
  onSave: (config: { repositoryUrl: string; events: string[] }) => void;
  onCancel: () => void;
  loading: boolean;
}

const WebhookSetupForm: React.FC<WebhookSetupFormProps> = ({
  initialData,
  onSave,
  onCancel,
  loading,
}) => {
  const [repositoryUrl, setRepositoryUrl] = useState(initialData?.repositoryUrl || '');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    initialData?.events || ['push', 'pull_request', 'issues']
  );

  const handleEventToggle = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repositoryUrl.trim() || selectedEvents.length === 0) return;
    
    onSave({
      repositoryUrl: repositoryUrl.trim(),
      events: selectedEvents,
    });
  };

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {initialData ? 'Update Webhook Configuration' : 'Setup GitHub Webhook'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Repository URL */}
        <div>
          <label htmlFor="repositoryUrl" className="block text-sm font-medium text-gray-700 mb-2">
            GitHub Repository URL
          </label>
          <input
            type="url"
            id="repositoryUrl"
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
            placeholder="https://github.com/username/repository"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <p className="text-xs text-gray-600 mt-1">
            The GitHub repository URL that will send webhook events
          </p>
        </div>

        {/* Event Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Events ({selectedEvents.length} selected)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {GITHUB_EVENTS.map((event) => (
              <label
                key={event.id}
                className="flex items-start space-x-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event.id)}
                  onChange={() => handleEventToggle(event.id)}
                  className="mt-0.5 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{event.label}</div>
                  <div className="text-xs text-gray-600">{event.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !repositoryUrl.trim() || selectedEvents.length === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {loading && <Spinner className="w-4 h-4 mr-2" />}
            {initialData ? 'Update Webhook' : 'Create Webhook'}
          </button>
        </div>
      </form>
    </div>
  );
};

/**
 * Webhook configuration display card
 */
interface WebhookConfigCardProps {
  webhook: WebhookConfig;
}

const WebhookConfigCard: React.FC<WebhookConfigCardProps> = ({ webhook }) => {
  const copyWebhookUrl = () => {
    if (webhook.webhookUrl) {
      navigator.clipboard.writeText(webhook.webhookUrl);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Webhook Configuration</h3>
        <span className={`px-2 py-1 text-xs rounded-full ${
          webhook.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {webhook.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Repository</label>
          <p className="text-sm text-gray-900">{webhook.repositoryUrl}</p>
        </div>

        {webhook.webhookUrl && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-gray-50 px-3 py-2 rounded border font-mono">
                {webhook.webhookUrl}
              </code>
              <button
                onClick={copyWebhookUrl}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                title="Copy webhook URL"
              >
                📋
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Monitored Events</label>
          <div className="flex flex-wrap gap-2">
            {webhook.events.map((event) => (
              <span
                key={event}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
              >
                {event}
              </span>
            ))}
          </div>
        </div>

        <div className="text-xs text-gray-600">
          <p>Created: {new Date(webhook.createdAt).toLocaleString()}</p>
          <p>Updated: {new Date(webhook.updatedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Webhook statistics component
 */
interface WebhookStatsProps {
  stats: WebhookStats;
}

const WebhookStats: React.FC<WebhookStatsProps> = ({ stats }) => {
  const successRate = stats.totalEvents > 0 
    ? ((stats.successfulEvents / stats.totalEvents) * 100).toFixed(1)
    : '0';

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Event Statistics</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.totalEvents}</div>
          <div className="text-sm text-gray-600">Total Events</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{stats.successfulEvents}</div>
          <div className="text-sm text-gray-600">Successful</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{stats.failedEvents}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{successRate}%</div>
          <div className="text-sm text-gray-600">Success Rate</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Webhook logs list component
 */
interface WebhookLogsListProps {
  logs: WebhookLog[];
}

const WebhookLogsList: React.FC<WebhookLogsListProps> = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-8 text-center">
        <div className="text-gray-400 text-4xl mb-4">📡</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Webhook Events</h3>
        <p className="text-gray-600">
          Webhook events will appear here when your repository sends them.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
      </div>
      
      <div className="divide-y">
        {logs.map((log) => (
          <div key={log.id} className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  log.success ? 'bg-green-500' : 'bg-red-500'
                }`} />
                
                <div>
                  <div className="font-medium text-sm text-gray-900">
                    {log.description}
                  </div>
                  <div className="text-xs text-gray-600">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  log.success 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {log.success ? 'Success' : 'Failed'}
                </span>
              </div>
            </div>
            
            {log.error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                <strong>Error:</strong> {log.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GitHubWebhookManager;