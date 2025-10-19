'use client';

import { APRSession } from './APRDashboard';
import { format } from 'date-fns';
import { useState } from 'react';

interface APRSessionDetailProps {
  session: APRSession;
}

export default function APRSessionDetail({ session }: APRSessionDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'attempts' | 'validations' | 'reviews'>(
    'overview'
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-2">
          {session.issuesDetected}
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Started:</span>{' '}
            <span className="text-gray-900 dark:text-gray-100">
              {session.startedAt ? format(session.startedAt, 'MMM d, h:mm a') : 'Not started'}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Duration:</span>{' '}
            <span className="text-gray-900 dark:text-gray-100">
              {session.processingTimeMs
                ? `${(session.processingTimeMs / 1000).toFixed(1)}s`
                : 'In progress'}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Trigger:</span>{' '}
            <span className="text-gray-900 dark:text-gray-100">{session.triggerType}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Confidence:</span>{' '}
            <span className="text-gray-900 dark:text-gray-100">
              {session.confidence ? `${(session.confidence * 100).toFixed(0)}%` : 'N/A'}
            </span>
          </div>
        </div>

        {session.prUrl && (
          <a
            href={session.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            📝 View PR #{session.prNumber}
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <Tab label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
        <Tab
          label={`Attempts (${session.attempts.length})`}
          active={activeTab === 'attempts'}
          onClick={() => setActiveTab('attempts')}
        />
        <Tab
          label={`Validations (${session.validations.length})`}
          active={activeTab === 'validations'}
          onClick={() => setActiveTab('validations')}
        />
        <Tab
          label={`Reviews (${session.reviews.length})`}
          active={activeTab === 'reviews'}
          onClick={() => setActiveTab('reviews')}
        />
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {activeTab === 'overview' && <OverviewTab session={session} />}
        {activeTab === 'attempts' && <AttemptsTab attempts={session.attempts} />}
        {activeTab === 'validations' && <ValidationsTab validations={session.validations} />}
        {activeTab === 'reviews' && <ReviewsTab reviews={session.reviews} />}
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

function OverviewTab({ session }: { session: APRSession }) {
  const analysis = session.analysisResult ? JSON.parse(session.analysisResult) : null;

  return (
    <div className="space-y-4">
      {/* Analysis Result */}
      {analysis && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">📋 Analysis</h4>
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 space-y-2 text-sm">
            {analysis.rootCause && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Root Cause:</span>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{analysis.rootCause}</p>
              </div>
            )}
            {analysis.proposedSolution && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Solution:</span>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{analysis.proposedSolution}</p>
              </div>
            )}
            {analysis.filesToModify && analysis.filesToModify.length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Files to Modify:</span>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1">
                  {analysis.filesToModify.map((file: string, i: number) => (
                    <li key={i}>{file}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Files Changed */}
      {session.filesChanged && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">📁 Files Changed</h4>
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
            <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {session.filesChanged}
            </pre>
          </div>
        </div>
      )}

      {/* Error Message */}
      {session.errorMessage && (
        <div>
          <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">❌ Error</h4>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{session.errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AttemptsTab({ attempts }: { attempts: APRSession['attempts'] }) {
  if (attempts.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No attempts yet</p>;
  }

  return (
    <div className="space-y-4">
      {attempts.map((attempt) => (
        <div
          key={attempt.id}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              Attempt #{attempt.attemptNumber}
              {attempt.success ? ' ✅' : ' ❌'}
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {format(attempt.createdAt, 'MMM d, h:mm a')}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Files Modified:</span>
              <p className="text-gray-600 dark:text-gray-400">
                {attempt.filesModified.join(', ') || 'None'}
              </p>
            </div>

            {attempt.errorMessage && (
              <div>
                <span className="font-medium text-red-700 dark:text-red-400">Error:</span>
                <p className="text-red-600 dark:text-red-400">{attempt.errorMessage}</p>
              </div>
            )}

            <details className="mt-2">
              <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                View Code Snippets
              </summary>
              <pre className="mt-2 bg-gray-50 dark:bg-gray-900 rounded p-3 text-xs overflow-x-auto">
                {attempt.codeSnippets}
              </pre>
            </details>
          </div>
        </div>
      ))}
    </div>
  );
}

function ValidationsTab({ validations }: { validations: APRSession['validations'] }) {
  if (validations.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No validations yet</p>;
  }

  // Group by attempt number
  const groupedValidations = validations.reduce((acc, val) => {
    if (!acc[val.attemptNumber]) {
      acc[val.attemptNumber] = [];
    }
    acc[val.attemptNumber].push(val);
    return acc;
  }, {} as Record<number, typeof validations>);

  return (
    <div className="space-y-4">
      {Object.entries(groupedValidations).map(([attemptNum, vals]) => (
        <div key={attemptNum} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Attempt #{attemptNum}
          </h4>
          <div className="space-y-2">
            {vals.map((val) => (
              <div
                key={val.id}
                className={`p-3 rounded ${
                  val.passed
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">
                    {val.passed ? '✅' : '❌'} {val.validationType}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {val.duration}ms
                  </span>
                </div>
                {!val.passed && val.errors && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-red-600 dark:text-red-400 hover:underline">
                      View Errors
                    </summary>
                    <pre className="mt-2 text-xs bg-white dark:bg-gray-900 rounded p-2 overflow-x-auto">
                      {val.errors}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab({ reviews }: { reviews: APRSession['reviews'] }) {
  if (reviews.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No reviews yet</p>;
  }

  const severityColors = {
    CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    INFO: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    severityColors[review.severity as keyof typeof severityColors] || severityColors.INFO
                  }`}
                >
                  {review.severity}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{review.reviewType.replace(/_/g, ' ')}</span>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{review.issue}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{review.explanation}</p>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            📁 {review.filePath}
            {review.lineNumber && `:${review.lineNumber}`}
          </div>

          {review.suggestion && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
                View Suggestion
              </summary>
              <pre className="mt-2 bg-gray-50 dark:bg-gray-900 rounded p-3 text-xs overflow-x-auto">
                {review.suggestion}
              </pre>
            </details>
          )}

          {review.postedToGitHub && (
            <div className="mt-2 text-xs text-green-600 dark:text-green-400">
              ✅ Posted to GitHub
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
