'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StatsData {
  projectId: string;
  total: number;
  approved: number;
  requiresChanges: number;
  avgScore: number;
  riskDistribution: Record<string, number>;
  impactDistribution: Record<string, number>;
  approvalRate: number;
  changeRequestRate: number;
}

const RISK_COLORS = {
  LOW: '#10b981',
  MEDIUM: '#fbbf24',
  HIGH: '#f97316',
  CRITICAL: '#dc2626',
};

const IMPACT_COLORS = {
  minimal: '#14b8a6',
  isolated: '#3b82f6',
  moderate: '#6366f1',
  widespread: '#9333ea',
  unknown: '#9ca3af',
};

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const res = await fetch('/api/code-review/stats?projectId=default');
        if (!res.ok) throw new Error('Failed to load stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading statistics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-red-500">
          Error: {error || 'No data available'}
        </div>
      </div>
    );
  }

  const riskData = Object.entries(stats.riskDistribution).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
  }));

  const impactData = Object.entries(stats.impactDistribution)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Code Review Statistics</h1>
        <div className="text-sm text-gray-600">Project: {stats.projectId}</div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600">Total Reviews</div>
          <div className="text-3xl font-bold mt-1">{stats.total}</div>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600">Average Score</div>
          <div className="text-3xl font-bold mt-1">{stats.avgScore}</div>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600">Approval Rate</div>
          <div className="text-3xl font-bold mt-1 text-green-600">{stats.approvalRate}%</div>
          <div className="text-xs text-gray-500 mt-1">{stats.approved} approved</div>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600">Change Request Rate</div>
          <div className="text-3xl font-bold mt-1 text-orange-600">{stats.changeRequestRate}%</div>
          <div className="text-xs text-gray-500 mt-1">{stats.requiresChanges} require changes</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Distribution Bar Chart */}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Risk Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={riskData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Count">
                {riskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.name as keyof typeof RISK_COLORS]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Impact Distribution Pie Chart */}
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Impact Scope Distribution</h2>
          {impactData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={impactData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {impactData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={IMPACT_COLORS[entry.name.toLowerCase() as keyof typeof IMPACT_COLORS] || '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400">
              No impact data available
            </div>
          )}
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Detailed Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Risk Levels</h3>
            <div className="space-y-2">
              {Object.entries(stats.riskDistribution).map(([level, count]) => (
                <div key={level} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: RISK_COLORS[level as keyof typeof RISK_COLORS] }} />
                    <span className="text-sm">{level}</span>
                  </div>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Impact Scopes</h3>
            <div className="space-y-2">
              {Object.entries(stats.impactDistribution)
                .filter(([, count]) => count > 0)
                .map(([scope, count]) => (
                  <div key={scope} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: IMPACT_COLORS[scope as keyof typeof IMPACT_COLORS] }} />
                      <span className="text-sm capitalize">{scope}</span>
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

