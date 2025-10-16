'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  PlayIcon,
  CogIcon
} from '@heroicons/react/24/outline';

// Types for the dashboard
interface AutoFixSession {
  id: string;
  projectId: string;
  projectName: string;
  status: 'pending' | 'analyzing' | 'fixing' | 'creating_pr' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  result?: {
    success: boolean;
    message: string;
    prUrl?: string;
    prNumber?: number;
    branchName?: string;
    filesChanged: string[];
    error?: string;
  };
  issues: Array<{
    type: string;
    severity: string;
    message: string;
    file?: string;
    line?: number;
  }>;
  triggerType: 'manual' | 'webhook' | 'ci_failure';
}

interface AutoFixStats {
  totalSessions: number;
  successfulFixes: number;
  activeSessions: number;
  lastWeekCount: number;
  successRate: number;
  averageResponseTime: number;
}

interface AutoFixSettings {
  enabled: boolean;
  requireApproval: boolean;
  maxFixesPerHour: number;
  branchPrefix: string;
  allowedTriggers: string[];
}

export default function AutoFixDashboard() {
  const [sessions, setSessions] = useState<AutoFixSession[]>([]);
  const [stats, setStats] = useState<AutoFixStats | null>(null);
  const [settings, setSettings] = useState<AutoFixSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'settings'>('overview');


  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch sessions, stats, and settings in parallel
      const [sessionsRes, statsRes, settingsRes] = await Promise.all([
        fetch('/api/github/auto-fix/sessions'),
        fetch('/api/github/auto-fix/stats'),
        fetch('/api/github/auto-fix/settings'),
      ]);

      if (!sessionsRes.ok || !statsRes.ok || !settingsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [sessionsData, statsData, settingsData] = await Promise.all([
        sessionsRes.json(),
        statsRes.json(),
        settingsRes.json(),
      ]);

      setSessions(sessionsData.data || []);
      setStats(statsData.data || null);
      setSettings(settingsData.data || null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Manual trigger auto-fix
  const triggerManualFix = async () => {
    try {
      const logContent = `Manual trigger from dashboard at ${new Date().toISOString()}`;
      
      const response = await fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: 'manual-trigger',
          logContent,
          triggerType: 'manual',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger auto-fix');
      }

      // Refresh dashboard data
      fetchDashboardData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Update settings
  const updateSettings = async (newSettings: Partial<AutoFixSettings>) => {
    try {
      const response = await fetch('/api/github/auto-fix/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Status icon helper
  const getStatusIcon = (status: AutoFixSession['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'pending':
      case 'analyzing':
      case 'fixing':
      case 'creating_pr':
        return <ClockIcon className="h-5 w-5 text-yellow-500 animate-spin" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // Status color helper
  const getStatusColor = (status: AutoFixSession['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-100';
      case 'failed':
        return 'text-red-700 bg-red-100';
      case 'pending':
      case 'analyzing':
      case 'fixing':
      case 'creating_pr':
        return 'text-yellow-700 bg-yellow-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <XCircleIcon className="h-6 w-6 text-red-500 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-red-900">Error Loading Dashboard</h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview' },
            { id: 'sessions', name: 'Fix History' },
            { id: 'settings', name: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.round(stats.successRate * 100)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <div className="flex items-center">
                  <ClockIcon className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Active Sessions</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.activeSessions}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <div className="flex items-center">
                  <ArrowTopRightOnSquareIcon className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">This Week</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.lastWeekCount}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="flex space-x-4">
              <button
                onClick={triggerManualFix}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlayIcon className="h-5 w-5 mr-2" />
                Trigger Manual Fix
              </button>
              
              <button
                onClick={() => setActiveTab('settings')}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <CogIcon className="h-5 w-5 mr-2" />
                Configure Settings
              </button>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Auto-Fix Sessions</h3>
            </div>
            
            <div className="divide-y divide-gray-200">
              {sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(session.status)}
                      <div>
                        <p className="font-medium text-gray-900">{session.projectName}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(session.createdAt).toLocaleString()} • {session.triggerType}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                      
                      {session.result?.prUrl && (
                        <a
                          href={session.result.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {sessions.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500">
                  No auto-fix sessions found. Trigger your first fix to get started!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">All Auto-Fix Sessions</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diff
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {session.projectName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {session.issues.length} issue{session.issues.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(session.status)}
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session.triggerType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(session.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {session.result?.success ? (
                        <div className="text-sm">
                          <div className="text-green-600 font-medium">Success</div>
                          {session.result.filesChanged.length > 0 && (
                            <div className="text-gray-500">
                              {session.result.filesChanged.length} file{session.result.filesChanged.length === 1 ? '' : 's'} changed
                            </div>
                          )}
                        </div>
                      ) : session.result?.error ? (
                        <div className="text-sm">
                          <div className="text-red-600 font-medium">Failed</div>
                          <div className="text-gray-500">{session.result.error}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">In progress</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => { const s = session as typeof session & { diffStats?: { totalHunks: number; totalBytes: number; truncated?: boolean } }; return s.diffStats ? (
                        <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono" title={`Bytes: ${s.diffStats.totalBytes}`}>Δ {s.diffStats.totalHunks}h{s.diffStats.truncated ? '+' : ''}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>; })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {session.result?.prUrl && (
                        <a
                          href={session.result.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View PR
                        </a>
                      )}
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => {/* TODO: Implement session details */}}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Details
                        </button>
                        <button
                          disabled={['cancelled','completed'].includes(session.status)}
                          onClick={async () => {
                            await fetch(`/api/auto-fix/session/${session.id}/regenerate`, { method: 'POST' });
                            fetchDashboardData();
                          }}
                          className="text-gray-600 hover:text-gray-900 disabled:opacity-40"
                          title="Regenerate"
                        >
                          ♻️
                        </button>
                        <button
                          disabled={['cancelled','completed'].includes(session.status)}
                          onClick={async () => {
                            await fetch(`/api/auto-fix/session/${session.id}/cancel`, { method: 'POST' });
                            fetchDashboardData();
                          }}
                          className="text-red-600 hover:text-red-800 disabled:opacity-40"
                          title="Cancel"
                        >
                          ⛔
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {sessions.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              No auto-fix sessions found.
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && settings && (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Auto-Fix Settings</h3>
          </div>
          
          <div className="px-6 py-4 space-y-6">
            {/* Enable/Disable Auto-Fix */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Enable Auto-Fix</h4>
                <p className="text-sm text-gray-500">
                  Allow automatic code fixes to be generated and applied
                </p>
              </div>
              <button
                onClick={() => updateSettings({ enabled: !settings.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.enabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Require Approval */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Require Approval</h4>
                <p className="text-sm text-gray-500">
                  Create PRs as drafts requiring manual approval before merging
                </p>
              </div>
              <button
                onClick={() => updateSettings({ requireApproval: !settings.requireApproval })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.requireApproval ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.requireApproval ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Max Fixes Per Hour */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Max Fixes Per Hour
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.maxFixesPerHour}
                onChange={(e) => updateSettings({ maxFixesPerHour: parseInt(e.target.value) })}
                className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <p className="text-sm text-gray-500 mt-1">
                Rate limit for automatic fixes to prevent spam
              </p>
            </div>

            {/* Branch Prefix */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Branch Prefix
              </label>
              <input
                type="text"
                value={settings.branchPrefix}
                onChange={(e) => updateSettings({ branchPrefix: e.target.value })}
                className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="codemind/auto-fix"
              />
              <p className="text-sm text-gray-500 mt-1">
                Prefix for auto-generated fix branches
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                onClick={() => {
                  // Settings are saved automatically on change
                  alert('Settings saved successfully!');
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}