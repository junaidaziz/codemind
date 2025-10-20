'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface IndexingJob {
  id: string;
  projectId: string;
  projectName: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  eventType: string;
  title: string;
  metadata: {
    processedFiles?: number;
    totalFiles?: number;
    percentage?: number;
    chunksCreated?: number;
    githubUrl?: string;
    duration?: number;
    errorCount?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface IndexingProgressWidgetProps {
  projectId?: string;
  refreshInterval?: number;
  showCompleted?: boolean;
  maxJobs?: number;
}

export default function IndexingProgressWidget({
  projectId,
  refreshInterval = 3000,
  showCompleted = false,
  maxJobs = 5,
}: IndexingProgressWidgetProps) {
  const [jobs, setJobs] = useState<IndexingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      if (showCompleted) params.set('includeCompleted', 'true');
      params.set('limit', maxJobs.toString());

      const response = await fetch(`/api/indexing/active?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch indexing jobs');
      }

      const data = await response.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching indexing jobs:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchActiveJobs();

    // Set up polling
    const interval = setInterval(fetchActiveJobs, refreshInterval);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, showCompleted, maxJobs]);

  const handleCancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh jobs list
        await fetchActiveJobs();
      } else {
        console.error('Failed to cancel job');
      }
    } catch (err) {
      console.error('Error canceling job:', err);
    }
  };

  const getProgressPercentage = (job: IndexingJob): number => {
    if (job.metadata.percentage !== undefined) {
      return job.metadata.percentage;
    }
    
    if (job.metadata.processedFiles && job.metadata.totalFiles) {
      return Math.round((job.metadata.processedFiles / job.metadata.totalFiles) * 100);
    }
    
    return 0;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-blue-500';
      case 'COMPLETED':
        return 'bg-green-500';
      case 'FAILED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'IN_PROGRESS':
        return '⏳';
      case 'COMPLETED':
        return '✅';
      case 'FAILED':
        return '❌';
      default:
        return '⚪';
    }
  };

  const estimateTimeRemaining = (job: IndexingJob): string | null => {
    const percentage = getProgressPercentage(job);
    if (percentage === 0) return null;

    const elapsed = Date.now() - new Date(job.createdAt).getTime();
    const totalEstimated = (elapsed / percentage) * 100;
    const remaining = totalEstimated - elapsed;

    if (remaining <= 0) return null;

    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `~${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `~${minutes}m ${seconds % 60}s`;
    return `~${seconds}s`;
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-gray-400 text-sm">Loading indexing jobs...</span>
        </div>
      </div>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-red-700">
        <div className="flex items-center space-x-2">
          <span className="text-red-400 text-sm">⚠️ {error}</span>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="text-center text-gray-400 text-sm py-2">
          No active indexing jobs
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const percentage = getProgressPercentage(job);
        const timeRemaining = estimateTimeRemaining(job);
        const isActive = job.status === 'IN_PROGRESS';

        return (
          <div
            key={job.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-lg">{getStatusIcon(job.status)}</span>
                  <h4 className="text-sm font-medium text-white">
                    {job.projectName || 'Project'}
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isActive ? 'bg-blue-500/10 text-blue-400' : 
                    job.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{job.title}</p>
              </div>

              {isActive && (
                <button
                  onClick={() => handleCancelJob(job.id)}
                  className="ml-2 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  title="Cancel job"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {isActive && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">
                    {job.metadata.processedFiles !== undefined && job.metadata.totalFiles !== undefined
                      ? `${job.metadata.processedFiles} / ${job.metadata.totalFiles} files`
                      : 'Processing...'}
                  </span>
                  <span className="text-xs font-medium text-blue-400">
                    {percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${getStatusColor(job.status)} transition-all duration-300 ease-out`}
                    style={{ width: `${percentage}%` }}
                  >
                    {isActive && (
                      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center space-x-4">
                {job.metadata.chunksCreated !== undefined && (
                  <span>
                    📦 {job.metadata.chunksCreated.toLocaleString()} chunks
                  </span>
                )}
                {job.metadata.errorCount !== undefined && job.metadata.errorCount > 0 && (
                  <span className="text-yellow-400">
                    ⚠️ {job.metadata.errorCount} errors
                  </span>
                )}
                {timeRemaining && isActive && (
                  <span className="text-blue-400">
                    ⏱️ {timeRemaining} remaining
                  </span>
                )}
              </div>
              <span>
                {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
