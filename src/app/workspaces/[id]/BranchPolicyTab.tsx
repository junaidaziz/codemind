'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { InlineSpinner } from '@/components/ui';

interface ProtectionRule {
  required_approving_review_count?: number;
  dismiss_stale_reviews?: boolean;
  require_code_owner_reviews?: boolean;
  required_status_checks?: string[];
  enforce_admins?: boolean;
  require_linear_history?: boolean;
  allow_force_pushes?: boolean;
  allow_deletions?: boolean;
}

interface RepositoryProtection {
  owner: string;
  repo: string;
  branch: string;
  protected: boolean;
  protection: ProtectionRule | null;
}

interface PolicyViolation {
  repo: string;
  branch: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  recommendation: string;
}

interface ComplianceReport {
  total_repos: number;
  protected_repos: number;
  unprotected_repos: number;
  compliance_score: number;
  violations: PolicyViolation[];
  recommendations: string[];
}

interface BranchPolicyTabProps {
  workspaceId: string;
}

export default function BranchPolicyTab({ workspaceId }: BranchPolicyTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [protections, setProtections] = useState<RepositoryProtection[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [detectingViolations, setDetectingViolations] = useState(false);
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<RepositoryProtection | null>(null);
  const [showPolicyConfig, setShowPolicyConfig] = useState(false);
  const [policyConfig, setPolicyConfig] = useState<ProtectionRule>({
    required_approving_review_count: 1,
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    required_status_checks: [],
    enforce_admins: false,
    require_linear_history: false,
    allow_force_pushes: false,
    allow_deletions: false,
  });

  useEffect(() => {
    fetchProtectionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const fetchProtectionStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<RepositoryProtection[]>(`/api/workspaces/${workspaceId}/branch-policy`);
      setProtections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch protection status');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      setError(null);
      const result = await apiPost<{ report: ComplianceReport }>(`/api/workspaces/${workspaceId}/branch-policy`, {
        action: 'generate_report',
      });
      setReport(result.report);
      setShowReport(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate compliance report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleDetectViolations = async () => {
    try {
      setDetectingViolations(true);
      setError(null);
      const result = await apiPost<{ report: ComplianceReport }>(`/api/workspaces/${workspaceId}/branch-policy`, {
        action: 'detect_violations',
      });
      setReport(result.report);
      setShowReport(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect violations');
    } finally {
      setDetectingViolations(false);
    }
  };

  const handleApplyDefaults = async () => {
    if (!confirm('Apply default protection rules to all unprotected repositories? This will:\n\n' +
      '• Require 1 approving review\n' +
      '• Dismiss stale reviews\n' +
      '• Disable force pushes\n' +
      '• Disable branch deletions\n\n' +
      'Continue?')) {
      return;
    }

    try {
      setApplyingDefaults(true);
      setError(null);
      await apiPost(`/api/workspaces/${workspaceId}/branch-policy`, {
        action: 'apply_defaults',
      });
      await fetchProtectionStatus();
      alert('✅ Default protection rules applied successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply default protections');
    } finally {
      setApplyingDefaults(false);
    }
  };

  const handleSetProtection = async (repo: RepositoryProtection) => {
    try {
      setError(null);
      await apiPost(`/api/workspaces/${workspaceId}/branch-policy`, {
        action: 'set_protection',
        owner: repo.owner,
        repo: repo.repo,
        branch: repo.branch,
        protection: policyConfig,
      });
      setShowPolicyConfig(false);
      setSelectedRepo(null);
      await fetchProtectionStatus();
      alert('✅ Branch protection updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update branch protection');
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded">🔴 Critical</span>;
      case 'high':
        return <span className="px-2 py-1 bg-orange-600 text-white text-xs font-medium rounded">🟠 High</span>;
      case 'medium':
        return <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-medium rounded">🟡 Medium</span>;
      case 'low':
        return <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">🔵 Low</span>;
      default:
        return <span className="px-2 py-1 bg-gray-600 text-white text-xs font-medium rounded">⚪ Unknown</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <InlineSpinner />
      </div>
    );
  }

  const protectedCount = protections.filter(p => p.protected).length;
  const unprotectedCount = protections.length - protectedCount;
  const complianceScore = protections.length > 0 ? (protectedCount / protections.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Repositories</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{protections.length}</p>
            </div>
            <div className="text-4xl">📁</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Protected</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{protectedCount}</p>
            </div>
            <div className="text-4xl">🛡️</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Unprotected</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">{unprotectedCount}</p>
            </div>
            <div className="text-4xl">⚠️</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Compliance</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{complianceScore.toFixed(0)}%</p>
            </div>
            <div className="text-4xl">📊</div>
          </div>
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

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Branch Protection Status</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDetectViolations}
            disabled={detectingViolations}
            className="px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {detectingViolations ? <InlineSpinner size="sm" /> : '🔍 Detect Violations'}
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={generatingReport}
            className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingReport ? <InlineSpinner size="sm" /> : '📋 Generate Report'}
          </button>
          <button
            onClick={handleApplyDefaults}
            disabled={applyingDefaults || unprotectedCount === 0}
            className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applyingDefaults ? <InlineSpinner size="sm" /> : '✅ Apply Defaults'}
          </button>
          <button
            onClick={fetchProtectionStatus}
            className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Compliance Report Modal */}
      {showReport && report && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">📋 Compliance Report</h3>
            <button
              onClick={() => setShowReport(false)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ✕
            </button>
          </div>

          {/* Report Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Repos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.total_repos}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Protected</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{report.protected_repos}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Unprotected</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{report.unprotected_repos}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Compliance</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{report.compliance_score.toFixed(0)}%</p>
            </div>
          </div>

          {/* Violations */}
          {report.violations.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Policy Violations</h4>
              <div className="space-y-2">
                {report.violations.map((violation, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {violation.repo} / {violation.branch}
                        </p>
                      </div>
                      {getSeverityBadge(violation.severity)}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      <strong>Issue:</strong> {violation.issue}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Recommendation:</strong> {violation.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Recommendations</h4>
              <ul className="space-y-2">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-blue-600 dark:text-blue-400">→</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Policy Configuration Modal */}
      {showPolicyConfig && selectedRepo && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Configure Protection: {selectedRepo.owner}/{selectedRepo.repo}
            </h3>
            <button
              onClick={() => {
                setShowPolicyConfig(false);
                setSelectedRepo(null);
              }}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Required Approving Reviews
              </label>
              <input
                type="number"
                min="0"
                max="6"
                value={policyConfig.required_approving_review_count}
                onChange={(e) => setPolicyConfig({ ...policyConfig, required_approving_review_count: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policyConfig.dismiss_stale_reviews}
                  onChange={(e) => setPolicyConfig({ ...policyConfig, dismiss_stale_reviews: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Dismiss stale reviews</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policyConfig.require_code_owner_reviews}
                  onChange={(e) => setPolicyConfig({ ...policyConfig, require_code_owner_reviews: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Require code owner reviews</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policyConfig.enforce_admins}
                  onChange={(e) => setPolicyConfig({ ...policyConfig, enforce_admins: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enforce for administrators</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policyConfig.require_linear_history}
                  onChange={(e) => setPolicyConfig({ ...policyConfig, require_linear_history: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Require linear history</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policyConfig.allow_force_pushes}
                  onChange={(e) => setPolicyConfig({ ...policyConfig, allow_force_pushes: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Allow force pushes</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={policyConfig.allow_deletions}
                  onChange={(e) => setPolicyConfig({ ...policyConfig, allow_deletions: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Allow branch deletions</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => {
                  setShowPolicyConfig(false);
                  setSelectedRepo(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSetProtection(selectedRepo)}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Protection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repository Protection List */}
      {protections.length > 0 ? (
        <div className="space-y-3">
          {protections.map((repo, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {repo.owner}/{repo.repo}
                    </h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      repo.protected
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                    }`}>
                      {repo.protected ? '🛡️ Protected' : '⚠️ Unprotected'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Branch: {repo.branch}</p>
                  {repo.protected && repo.protection && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                      {repo.protection.required_approving_review_count && (
                        <span>✓ {repo.protection.required_approving_review_count} review(s) required</span>
                      )}
                      {repo.protection.dismiss_stale_reviews && <span>✓ Dismiss stale reviews</span>}
                      {repo.protection.require_code_owner_reviews && <span>✓ Code owner review</span>}
                      {repo.protection.enforce_admins && <span>✓ Enforce for admins</span>}
                      {repo.protection.require_linear_history && <span>✓ Linear history</span>}
                    </div>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => {
                      setSelectedRepo(repo);
                      if (repo.protection) {
                        setPolicyConfig(repo.protection);
                      }
                      setShowPolicyConfig(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ⚙️ Configure
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="text-6xl mb-6">🛡️</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            No Repositories Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Add repositories to this workspace to manage their branch protection policies.
          </p>
        </div>
      )}
    </div>
  );
}
