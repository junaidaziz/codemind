'use client';

import React, { useState, useEffect } from 'react';
// Using simple div-based components for now - can be replaced with proper UI library components
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 border-b border-gray-200 ${className}`}>
    {children}
  </div>
);

const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 ${className}`}>
    {children}
  </div>
);

const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h3 className={`font-semibold text-gray-900 ${className}`}>
    {children}
  </h3>
);

const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`text-sm text-gray-600 mt-1 ${className}`}>
    {children}
  </p>
);

const Button: React.FC<{ children: React.ReactNode; variant?: string; size?: string; className?: string }> = ({ children, className = '' }) => (
  <button className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${className}`}>
    {children}
  </button>
);

const Badge: React.FC<{ children: React.ReactNode; variant?: string; className?: string }> = ({ children, className = '' }) => (
  <span className={`px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium ${className}`}>
    {children}
  </span>
);

const Switch: React.FC<{ checked: boolean; onCheckedChange: (checked: boolean) => void; className?: string }> = ({ checked, onCheckedChange, className = '' }) => (
  <button
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? 'bg-blue-600' : 'bg-gray-200'
    } ${className}`}
    onClick={() => onCheckedChange(!checked)}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const Alert: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 border rounded-lg ${className}`}>
    {children}
  </div>
);

const AlertDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={className}>
    {children}
  </div>
);

// Simple icon components (can be replaced with proper icon library)
const CheckCircle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-4 h-4 rounded-full bg-green-500 flex items-center justify-center ${className}`}>
    <span className="text-white text-xs">✓</span>
  </div>
);

const XCircle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-4 h-4 rounded-full bg-red-500 flex items-center justify-center ${className}`}>
    <span className="text-white text-xs">✗</span>
  </div>
);

const Clock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-3 h-3 rounded-full bg-yellow-500 ${className}`} />
);

const AlertCircle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-3 h-3 rounded-full bg-red-500 ${className}`} />
);

const Settings: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-4 h-4 bg-gray-600 ${className}`} />
);

const Github: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-4 h-4 bg-gray-800 ${className}`} />
);

const Zap: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-4 h-4 bg-yellow-500 ${className}`} />
);

const Activity: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-4 h-4 bg-blue-500 ${className}`} />
);

const BarChart3: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`w-4 h-4 bg-green-500 ${className}`} />
);

interface CIStatus {
  webhook: {
    configured: boolean;
    recentEvents: number;
  };
  jobQueue: {
    running: boolean;
    pendingJobs: number;
    failedJobs: number;
  };
  github: {
    tokenConfigured: boolean;
    apiLimitRemaining: number | null;
  };
}

interface CIConfig {
  github: {
    enabled: boolean;
    webhookSecret?: string;
    prAnalysis: {
      enabled: boolean;
      autoComment: boolean;
      updateExisting: boolean;
    };
  };
  jobQueue: {
    enabled: boolean;
    maxConcurrentJobs: number;
    retryAttempts: number;
    retryDelay: number;
  };
  analysis: {
    riskThreshold: number;
    qualityThreshold: number;
    autoAnalyzeOnPush: boolean;
    autoAnalyzeOnPR: boolean;
  };
}

export const CIDashboard: React.FC = () => {
  const [status, setStatus] = useState<CIStatus | null>(null);
  const [config, setConfig] = useState<CIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch CI status and configuration
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch status
        const statusResponse = await fetch('/api/ci/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to fetch CI status');
        }

        const statusData = await statusResponse.json();
        setStatus(statusData.data.status);

        // Fetch configuration
        const configResponse = await fetch('/api/ci/config');
        
        if (!configResponse.ok) {
          throw new Error('Failed to fetch CI configuration');
        }

        const configData = await configResponse.json();
        setConfig(configData.data.config);

      } catch (error) {
        console.error('Error fetching CI data:', error);
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update configuration
  const updateConfig = async (newConfig: Partial<CIConfig>) => {
    try {
      const response = await fetch('/api/ci/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to update configuration');
      }

      const data = await response.json();
      setConfig(data.data.config);
      
    } catch (error) {
      console.error('Error updating configuration:', error);
      setError((error as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Failed to load CI dashboard: {error}
        </AlertDescription>
      </Alert>
    );
  }

  const StatusIndicator: React.FC<{ status: boolean; label: string }> = ({ status, label }) => (
    <div className="flex items-center space-x-2">
      {status ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CI Integration Dashboard</h1>
          <p className="text-gray-600">Manage continuous integration and automated code analysis</p>
        </div>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Advanced Settings
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Github className="h-4 w-4 mr-2" />
              GitHub Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatusIndicator 
                status={status?.github.tokenConfigured || false} 
                label="API Token" 
              />
              <StatusIndicator 
                status={status?.webhook.configured || false} 
                label="Webhook" 
              />
              {status?.webhook.recentEvents !== undefined && (
                <div className="text-xs text-gray-500">
                  {status.webhook.recentEvents} recent events
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Zap className="h-4 w-4 mr-2" />
              Job Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatusIndicator 
                status={status?.jobQueue.running || false} 
                label="Processing" 
              />
              {status?.jobQueue && (
                <>
                  <div className="flex items-center space-x-2 text-xs">
                    <Clock className="h-3 w-3 text-yellow-500" />
                    <span>{status.jobQueue.pendingJobs} pending</span>
                  </div>
                  {status.jobQueue.failedJobs > 0 && (
                    <div className="flex items-center space-x-2 text-xs">
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      <span>{status.jobQueue.failedJobs} failed</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Analysis Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatusIndicator 
                status={config?.github.prAnalysis.enabled || false} 
                label="PR Analysis" 
              />
              <StatusIndicator 
                status={config?.analysis.autoAnalyzeOnPR || false} 
                label="Auto Analysis" 
              />
              <div className="text-xs text-gray-500">
                Risk threshold: {config?.analysis.riskThreshold || 7}/10
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      {config && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Github className="h-5 w-5 mr-2" />
                GitHub Settings
              </CardTitle>
              <CardDescription>
                Configure GitHub integration and pull request analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">GitHub Integration</label>
                  <p className="text-xs text-gray-500">Enable GitHub webhook processing</p>
                </div>
                <Switch
                  checked={config.github.enabled}
                  onCheckedChange={(enabled) =>
                    updateConfig({
                      github: { ...config.github, enabled }
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">PR Analysis</label>
                  <p className="text-xs text-gray-500">Automatically analyze pull requests</p>
                </div>
                <Switch
                  checked={config.github.prAnalysis.enabled}
                  onCheckedChange={(enabled) =>
                    updateConfig({
                      github: {
                        ...config.github,
                        prAnalysis: { ...config.github.prAnalysis, enabled }
                      }
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Auto Comments</label>
                  <p className="text-xs text-gray-500">Post analysis results as PR comments</p>
                </div>
                <Switch
                  checked={config.github.prAnalysis.autoComment}
                  onCheckedChange={(autoComment) =>
                    updateConfig({
                      github: {
                        ...config.github,
                        prAnalysis: { ...config.github.prAnalysis, autoComment }
                      }
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Analysis Settings
              </CardTitle>
              <CardDescription>
                Configure code analysis thresholds and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Auto-analyze PRs</label>
                  <p className="text-xs text-gray-500">Automatically analyze new pull requests</p>
                </div>
                <Switch
                  checked={config.analysis.autoAnalyzeOnPR}
                  onCheckedChange={(autoAnalyzeOnPR) =>
                    updateConfig({
                      analysis: { ...config.analysis, autoAnalyzeOnPR }
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Auto-analyze Pushes</label>
                  <p className="text-xs text-gray-500">Automatically analyze code pushes</p>
                </div>
                <Switch
                  checked={config.analysis.autoAnalyzeOnPush}
                  onCheckedChange={(autoAnalyzeOnPush) =>
                    updateConfig({
                      analysis: { ...config.analysis, autoAnalyzeOnPush }
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Risk Threshold</label>
                  <Badge variant="outline">{config.analysis.riskThreshold}/10</Badge>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.analysis.riskThreshold}
                  onChange={(e) =>
                    updateConfig({
                      analysis: { 
                        ...config.analysis, 
                        riskThreshold: parseInt(e.target.value) 
                      }
                    })
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-gray-500">
                  Changes above this risk level will be flagged for review
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Recent CI integration events and job executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity to display</p>
            <p className="text-sm">CI events and job results will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};