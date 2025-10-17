'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { FullPageSpinner, ErrorBanner } from '../../../../components/ui';

interface UnifiedTask {
  id: string;
  title: string;
  description: string;
  status: string;
  source: 'github' | 'jira' | 'trello';
  url: string;
  labels: string[];
  assignees: string[];
  priority?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  type?: string;
}

interface Project {
  id: string;
  name: string;
}

function TasksPageContent() {
  const params = useParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<UnifiedTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<UnifiedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sourceFilter, statusFilter, searchQuery]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.data);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      const data = await response.json();

      if (response.ok && data.success) {
        setTasks(data.data);
      } else {
        setError(data.error || 'Failed to fetch tasks');
      }
    } catch (err) {
      setError('Error loading tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tasks];

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(task => task.source === sourceFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status.toLowerCase().includes(statusFilter.toLowerCase()));
    }

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.labels.some(label => label.toLowerCase().includes(query))
      );
    }

    setFilteredTasks(filtered);
  };

  const getSourceBadge = (source: string) => {
    const badges = {
      github: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      jira: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      trello: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    };
    return badges[source as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getSourceIcon = (source: string) => {
    const icons = {
      github: '🐙',
      jira: '🎯',
      trello: '📋'
    };
    return icons[source as keyof typeof icons] || '📌';
  };

  const getStatusBadge = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('open') || lowerStatus.includes('to do')) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    }
    if (lowerStatus.includes('progress') || lowerStatus.includes('doing')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    }
    if (lowerStatus.includes('closed') || lowerStatus.includes('done')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const sourceCounts = {
    github: tasks.filter(t => t.source === 'github').length,
    jira: tasks.filter(t => t.source === 'jira').length,
    trello: tasks.filter(t => t.source === 'trello').length
  };

  if (loading) {
    return <FullPageSpinner />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Link 
                href={`/projects/${projectId}`}
                className="text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block"
              >
                ← Back to {project?.name || 'Project'}
              </Link>
              <h1 className="text-3xl font-bold mb-2">📋 Task Management</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Unified view of tasks from GitHub, Jira, and Trello
              </p>
            </div>
            <button
              onClick={fetchTasks}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-2xl font-bold">{tasks.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl mb-1">🐙</div>
              <div className="text-2xl font-bold">{sourceCounts.github}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">GitHub Issues</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-2xl font-bold">{sourceCounts.jira}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Jira Issues</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-2xl font-bold">{sourceCounts.trello}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Trello Cards</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium mb-2">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Sources</option>
                  <option value="github">🐙 GitHub</option>
                  <option value="jira">🎯 Jira</option>
                  <option value="trello">📋 Trello</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open / To Do</option>
                  <option value="progress">In Progress</option>
                  <option value="done">Done / Closed</option>
                </select>
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

        {/* Tasks List */}
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold mb-2">No Tasks Found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {tasks.length === 0 
                  ? 'No tasks available. Configure GitHub, Jira, or Trello in project settings.'
                  : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSourceBadge(task.source)}`}>
                        {getSourceIcon(task.source)} {task.source.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(task.status)}`}>
                        {task.status}
                      </span>
                      {task.priority && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                          {task.priority}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      <a 
                        href={task.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      >
                        {task.title} ↗
                      </a>
                    </h3>
                    {task.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {task.author && (
                        <span>👤 {task.author}</span>
                      )}
                      {task.assignees.length > 0 && (
                        <span>👥 {task.assignees.join(', ')}</span>
                      )}
                      {task.dueDate && (
                        <span>📅 Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                      )}
                      <span>🕒 Updated: {new Date(task.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {task.labels.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {task.labels.map((label, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                          >
                            🏷️ {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  return (
    <ProtectedRoute>
      <TasksPageContent />
    </ProtectedRoute>
  );
}
