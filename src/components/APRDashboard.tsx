'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import APRSessionList from './APRSessionList';
import APRSessionDetail from './APRSessionDetail';
import APRFilters from './APRFilters';

interface AutoFixAttempt {
  id: string;
  attemptNumber: number;
  filesModified: string[];
  prompt: string;
  aiResponse: string;
  codeSnippets: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
}

interface AutoFixValidation {
  id: string;
  validationType: string;
  passed: boolean;
  output: string;
  errors: string | null;
  duration: number;
  attemptNumber: number;
  executedAt: Date;
}

interface AutoFixReview {
  id: string;
  reviewType: string;
  severity: string;
  filePath: string;
  lineNumber: number | null;
  issue: string;
  explanation: string;
  suggestion: string | null;
  category: string;
  tags: string[];
  postedToGitHub: boolean;
  githubCommentId: string | null;
  createdAt: Date;
}

export interface APRSession {
  id: string;
  projectId: string;
  userId: string | null;
  status: string;
  triggerType: string;
  issuesDetected: string;
  analysisResult: string | null;
  branchName: string | null;
  prUrl: string | null;
  prNumber: number | null;
  filesChanged: string | null;
  processingTimeMs: number | null;
  errorMessage: string | null;
  confidence: number | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  attempts: AutoFixAttempt[];
  validations: AutoFixValidation[];
  reviews: AutoFixReview[];
}

export default function APRDashboard() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<APRSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<APRSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    projectId: searchParams?.get('projectId') || '',
    status: searchParams?.get('status') || '',
  });

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.status) params.set('status', filters.status);

      const response = await fetch(`/api/apr/sessions?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      
      interface SessionResponse {
        id: string;
        projectId: string;
        userId: string | null;
        status: string;
        triggerType: string;
        issuesDetected: string;
        analysisResult: string | null;
        branchName: string | null;
        prUrl: string | null;
        prNumber: number | null;
        filesChanged: string | null;
        processingTimeMs: number | null;
        errorMessage: string | null;
        confidence: number | null;
        createdAt: string;
        updatedAt: string;
        startedAt: string | null;
        completedAt: string | null;
        attempts: Array<{
          id: string;
          attemptNumber: number;
          filesModified: string[];
          prompt: string;
          aiResponse: string;
          codeSnippets: string;
          success: boolean;
          errorMessage: string | null;
          createdAt: string;
        }>;
        validations: Array<{
          id: string;
          validationType: string;
          passed: boolean;
          output: string;
          errors: string | null;
          duration: number;
          attemptNumber: number;
          executedAt: string;
        }>;
        reviews: Array<{
          id: string;
          reviewType: string;
          severity: string;
          filePath: string;
          lineNumber: number | null;
          issue: string;
          explanation: string;
          suggestion: string | null;
          category: string;
          tags: string[];
          postedToGitHub: boolean;
          githubCommentId: string | null;
          createdAt: string;
        }>;
      }
      
      setSessions(data.sessions.map((s: SessionResponse) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
        startedAt: s.startedAt ? new Date(s.startedAt) : null,
        completedAt: s.completedAt ? new Date(s.completedAt) : null,
        attempts: s.attempts.map((a) => ({
          ...a,
          createdAt: new Date(a.createdAt),
        })),
        validations: s.validations.map((v) => ({
          ...v,
          executedAt: new Date(v.executedAt),
        })),
        reviews: s.reviews.map((r) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        })),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">❌ {error}</p>
        <button
          onClick={() => fetchSessions()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <APRFilters filters={filters} onFilterChange={setFilters} />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Sessions"
          value={sessions.length}
          icon="📊"
          color="blue"
        />
        <StatCard
          title="Completed"
          value={sessions.filter(s => s.status === 'COMPLETED').length}
          icon="✅"
          color="green"
        />
        <StatCard
          title="In Progress"
          value={sessions.filter(s => ['ANALYZING', 'FIXING', 'CREATING_PR'].includes(s.status)).length}
          icon="⏳"
          color="yellow"
        />
        <StatCard
          title="Failed"
          value={sessions.filter(s => s.status === 'FAILED').length}
          icon="❌"
          color="red"
        />
      </div>

      {/* Session List / Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">APR Sessions</h2>
          <APRSessionList
            sessions={sessions}
            selectedSessionId={selectedSession?.id}
            onSelectSession={setSelectedSession}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Session Details</h2>
          {selectedSession ? (
            <APRSessionDetail session={selectedSession} />
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                Select a session to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  return (
    <div className={`${colors[color]} border rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}
