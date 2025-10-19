'use client';

import { APRSession } from './APRDashboard';
import { formatDistanceToNow } from 'date-fns';
import { getRiskColor, getRiskEmoji } from '@/lib/pr-risk-scorer';

interface APRSessionListProps {
  sessions: APRSession[];
  selectedSessionId: string | undefined;
  onSelectSession: (session: APRSession) => void;
}

export default function APRSessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
}: APRSessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          No APR sessions found. Create your first autonomous PR!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          isSelected={session.id === selectedSessionId}
          onClick={() => onSelectSession(session)}
        />
      ))}
    </div>
  );
}

interface SessionCardProps {
  session: APRSession;
  isSelected: boolean;
  onClick: () => void;
}

function SessionCard({ session, isSelected, onClick }: SessionCardProps) {
  const statusColors = {
    PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    ANALYZING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    FIXING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    CREATING_PR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };

  const statusIcons = {
    PENDING: '⏸️',
    ANALYZING: '🔍',
    FIXING: '🔧',
    CREATING_PR: '📝',
    COMPLETED: '✅',
    FAILED: '❌',
    CANCELLED: '🚫',
  };

  // Extract risk from analysisResult
  let riskLevel = null;
  let riskEmoji = null;
  let riskColor = '';
  
  try {
    if (session.analysisResult) {
      const analysis = JSON.parse(session.analysisResult);
      if (analysis.risk) {
        riskLevel = analysis.risk.level;
        riskEmoji = getRiskEmoji(riskLevel);
        riskColor = getRiskColor(riskLevel);
      }
    }
  } catch {
    // Ignore parse errors
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">
              {statusIcons[session.status as keyof typeof statusIcons] || '📋'}
            </span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                statusColors[session.status as keyof typeof statusColors] || statusColors.PENDING
              }`}
            >
              {session.status}
            </span>
            {riskLevel && (
              <span
                className={`px-2 py-1 rounded text-xs font-medium border ${riskColor}`}
                title={`Risk Level: ${riskLevel}`}
              >
                {riskEmoji} {riskLevel}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
            {session.issuesDetected}
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>{formatDistanceToNow(session.createdAt, { addSuffix: true })}</span>
        <div className="flex items-center gap-3">
          {session.attempts.length > 0 && (
            <span title="Retry attempts">🔄 {session.attempts.length}</span>
          )}
          {session.reviews.length > 0 && (
            <span title="Review findings">⚠️ {session.reviews.length}</span>
          )}
          {session.prNumber && (
            <span title="PR created">
              📝 #{session.prNumber}
            </span>
          )}
        </div>
      </div>

      {session.errorMessage && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400 line-clamp-1">
          ❌ {session.errorMessage}
        </div>
      )}
    </button>
  );
}
