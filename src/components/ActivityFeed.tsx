'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityEvent {
  id: string;
  projectId: string;
  userId: string | null;
  eventType: string;
  entityType: string;
  entityId: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  duration: number | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface ActivityFeedProps {
  projectId?: string;
  limit?: number;
}

export default function ActivityFeed({ projectId, limit = 50 }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    eventType: '',
    status: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit,
    offset: 0,
    hasMore: false,
  });

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filters.eventType, filters.status, filters.search]);

  const fetchEvents = async (offset = 0) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (projectId) params.append('projectId', projectId);
      if (filters.eventType) params.append('eventType', filters.eventType);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/activity/feed?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.events || data.events.length === 0) {
        setEvents([]);
        setError('No activity events found yet. Activity will appear here as you use the platform.');
        return;
      }
      
      setEvents(data.events);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      console.error('Error fetching activity feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity feed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (pagination.hasMore) {
      fetchEvents(pagination.offset + pagination.limit);
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">ℹ️</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                No Activity Yet
              </h3>
              <p className="text-yellow-800 dark:text-yellow-300 mb-4">
                {error}
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => fetchEvents(0)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  🔄 Retry
                </button>
                <button
                  onClick={() => window.location.href = '/projects'}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  📁 Go to Projects
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Event Type
            </label>
            <select
              value={filters.eventType}
              onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="INDEXING_STARTED">Indexing Started</option>
              <option value="INDEXING_COMPLETED">Indexing Completed</option>
              <option value="APR_SESSION_CREATED">APR Session Created</option>
              <option value="APR_ANALYZING">APR Analyzing</option>
              <option value="APR_CODE_GENERATION">Code Generation</option>
              <option value="APR_VALIDATION">Validation</option>
              <option value="APR_REVIEW">Code Review</option>
              <option value="APR_PR_CREATED">PR Created</option>
              <option value="APR_COMPLETED">APR Completed</option>
              <option value="APR_FAILED">APR Failed</option>
              <option value="CHAT_MESSAGE_SENT">Chat Message</option>
              <option value="AUTO_FIX_STARTED">Auto Fix Started</option>
              <option value="AUTO_FIX_COMPLETED">Auto Fix Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search activities..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No activity events found. AI actions will appear here as they happen.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <ActivityEventCard key={event.id} event={event} isLast={index === events.length - 1} />
          ))}

          {pagination.hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActivityEventCardProps {
  event: ActivityEvent;
  isLast: boolean;
}

function ActivityEventCard({ event, isLast }: ActivityEventCardProps) {
  const getEventIcon = (eventType: string) => {
    if (eventType.startsWith('INDEXING')) return '📚';
    if (eventType.startsWith('APR')) return '🤖';
    if (eventType.startsWith('CHAT')) return '💬';
    if (eventType.startsWith('AUTO_FIX')) return '🔧';
    if (eventType.startsWith('CODE_SCAFFOLDING')) return '🏗️';
    if (eventType.startsWith('TEST_GENERATION')) return '🧪';
    return '✨';
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return badges[status as keyof typeof badges] || badges.IN_PROGRESS;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'IN_PROGRESS') return '⏳';
    if (status === 'COMPLETED') return '✅';
    if (status === 'FAILED') return '❌';
    if (status === 'CANCELLED') return '🚫';
    return '';
  };

  return (
    <div className="relative pl-8 pb-8">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
      )}

      {/* Event icon */}
      <div className="absolute left-0 top-0 flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-full text-sm">
        {getEventIcon(event.eventType)}
      </div>

      {/* Event card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {event.title}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(event.status)}`}>
                {getStatusIcon(event.status)} {event.status.replace('_', ' ')}
              </span>
            </div>
            {event.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* Metadata */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(event.metadata).slice(0, 4).map(([key, value]) => (
                <div key={key}>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{key}:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">
                    {typeof value === 'object' ? JSON.stringify(value).slice(0, 30) + '...' : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="font-medium">{event.project.name}</span>
            {event.duration && (
              <span>⏱️ {(event.duration / 1000).toFixed(2)}s</span>
            )}
            {event.user && (
              <span>👤 {event.user.name || event.user.email}</span>
            )}
          </div>
          <span>{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}
