'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Deployment {
  id: string;
  projectId: string;
  commitSha: string;
  branch: string;
  status: string;
  url?: string;
  deploymentUrl?: string;
  environment?: string;
  provider: string;
  buildDuration?: number;
  healthCheckResult?: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    statusCode?: number;
    responseTime?: number;
    error?: string;
    checkedAt: string;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  codeReview?: {
    id: string;
    prNumber: number;
    riskLevel: string;
    overallScore: number;
    approved: boolean;
  } | null;
}

function statusColor(status: string) {
  switch (status) {
    case 'READY': return 'bg-green-500 text-white';
    case 'BUILDING': return 'bg-blue-500 text-white';
    case 'QUEUED': return 'bg-gray-400 text-white';
    case 'ERROR': return 'bg-red-600 text-white';
    case 'CANCELED': return 'bg-yellow-500 text-black';
    default: return 'bg-gray-300 text-black';
  }
}

function healthColor(status?: string) {
  switch (status) {
    case 'healthy': return 'text-green-600';
    case 'unhealthy': return 'text-red-600';
    default: return 'text-gray-400';
  }
}

function riskColor(risk: string) {
  switch (risk) {
    case 'CRITICAL': return 'bg-red-600 text-white';
    case 'HIGH': return 'bg-orange-500 text-white';
    case 'MEDIUM': return 'bg-yellow-400 text-black';
    case 'LOW': return 'bg-green-500 text-white';
    default: return 'bg-gray-300 text-black';
  }
}

export default function DeploymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  const statusFilter = searchParams.get('status') || '';
  const environmentFilter = searchParams.get('environment') || '';

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ projectId: 'default' });
      if (statusFilter) params.set('status', statusFilter);
      if (environmentFilter) params.set('environment', environmentFilter);

      const res = await fetch(`/api/deployments/list?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDeployments(data.deployments || []);
      } else {
        setDeployments([]);
      }
      setLoading(false);
    }
    load();
  }, [statusFilter, environmentFilter]);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/deployments?${params.toString()}`);
  };

  const handleHealthCheck = async (deploymentId: string) => {
    try {
      const res = await fetch('/api/deployments/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentId }),
      });
      if (res.ok) {
        // Reload deployments to show updated health status
        window.location.reload();
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deployments</h1>
        <div className="flex gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="border rounded px-3 py-1 text-sm bg-white"
            >
              <option value="">All Status</option>
              <option value="READY">Ready</option>
              <option value="BUILDING">Building</option>
              <option value="QUEUED">Queued</option>
              <option value="ERROR">Error</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Environment</label>
            <select
              value={environmentFilter}
              onChange={(e) => handleFilterChange('environment', e.target.value)}
              className="border rounded px-3 py-1 text-sm bg-white"
            >
              <option value="">All Environments</option>
              <option value="production">Production</option>
              <option value="preview">Preview</option>
              <option value="development">Development</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading deployments...</div>
      ) : (
        <div className="space-y-4">
          {deployments.map((d) => (
            <div key={d.id} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(d.status)}`}>
                      {d.status}
                    </span>
                    {d.environment && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {d.environment}
                      </span>
                    )}
                    {d.healthCheckResult && (
                      <span className={`text-xs font-medium ${healthColor(d.healthCheckResult.status)}`}>
                        ● {d.healthCheckResult.status} {d.healthCheckResult.responseTime && `(${d.healthCheckResult.responseTime}ms)`}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div><strong>Branch:</strong> {d.branch}</div>
                    <div><strong>Commit:</strong> <span className="font-mono text-xs">{d.commitSha.slice(0, 7)}</span></div>
                    {d.deploymentUrl && (
                      <div>
                        <strong>URL:</strong>{' '}
                        <a href={d.deploymentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                          {d.deploymentUrl}
                        </a>
                      </div>
                    )}
                    {d.buildDuration && (
                      <div><strong>Build Duration:</strong> {Math.round(d.buildDuration / 1000)}s</div>
                    )}
                    {d.errorMessage && (
                      <div className="text-red-600 text-xs mt-2">Error: {d.errorMessage}</div>
                    )}
                    <div className="text-xs text-gray-500">
                      Deployed {new Date(d.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {d.codeReview && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Code Review:</span>
                        <span className="font-mono">PR #{d.codeReview.prNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskColor(d.codeReview.riskLevel)}`}>
                          {d.codeReview.riskLevel}
                        </span>
                        <span className="text-xs text-gray-600">Score: {d.codeReview.overallScore}</span>
                        {d.codeReview.approved && (
                          <span className="text-xs text-green-600">✓ Approved</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {d.status === 'READY' && (
                  <button
                    onClick={() => handleHealthCheck(d.id)}
                    className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
                  >
                    Check Health
                  </button>
                )}
              </div>
            </div>
          ))}
          {deployments.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {statusFilter || environmentFilter ? 'No deployments match the selected filters.' : 'No deployments yet.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
