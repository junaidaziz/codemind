'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface AutoFixStats {
  totalSessions: number
  successfulSessions: number
  failedSessions: number
  totalPRsCreated: number
  successRate: number
}

interface AutoFixSession {
  id: string
  projectId: string
  status: string
  createdAt: string
}

export default function SimpleAutoFixDashboard() {
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<AutoFixStats | null>(null)
  const [sessions, setSessions] = useState<AutoFixSession[]>([])
  const [error, setError] = useState<string | null>(null)
  const [healthCheck, setHealthCheck] = useState<{
    overall: string
    checks: Record<string, { status: string; message: string }>
    recommendations: string[]
  } | null>(null)

  // Fetch dashboard data
  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Fetch stats
      const statsResponse = await fetch('/api/auto-fix/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }

      // Fetch recent sessions
      const sessionsResponse = await fetch('/api/auto-fix/sessions?limit=5')
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json()
        setSessions(sessionsData.sessions)
      }

      // Fetch health check
      const healthResponse = await fetch('/api/auto-fix/health')
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setHealthCheck(healthData)
      }
    } catch (err) {
      setError('Failed to load dashboard data')
      console.error('Dashboard error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Test auto-fix system
  const testAutoFix = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'test-project',
          logContent: 'Test error log for auto-fix system validation',
          triggerType: 'manual'
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Auto-fix triggered successfully! Session ID: ${result.sessionId}`)
        fetchData() // Refresh data
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to trigger auto-fix')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Auto-fix error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header with Feature Overview */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🤖 Auto Fix Dashboard
        </h1>
        <p className="text-gray-600 mb-4">
          AI-powered automated code repair system with GitHub integration
        </p>
        
        {/* Available Features */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">✨ Available Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-blue-800">AI Error Analysis (GPT-4)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-blue-800">Automatic PR Creation</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-blue-800">GitHub Actions Integration</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-blue-800">JavaScript/TypeScript Support</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-blue-800">Syntax & Runtime Error Fixes</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-blue-800">Real-time Monitoring</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">🚀 Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button 
            onClick={testAutoFix}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white h-12"
          >
            {isLoading ? '🔄 Processing...' : '🧪 Test Auto Fix'}
          </Button>
          
          <Button 
            onClick={fetchData}
            disabled={isLoading}
            variant="outline"
            className="h-12"
          >
            🔄 Refresh Data
          </Button>

          <Button 
            onClick={() => window.open('/api/github/auto-fix', '_blank')}
            variant="outline"
            className="h-12"
          >
            🔗 Test GitHub Auth
          </Button>
        </div>

        {/* How to Use Instructions */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">🎯 How to Use:</h3>
          <ol className="text-sm text-gray-600 space-y-1">
            <li><strong>1. Test Auto Fix:</strong> Click to test the system with sample error logs</li>
            <li><strong>2. Monitor Sessions:</strong> Watch the Recent Sessions section for results</li>
            <li><strong>3. Check GitHub:</strong> Look for automatically created pull requests in your repository</li>
            <li><strong>4. CI Integration:</strong> Push code with errors to trigger automatic fixes</li>
          </ol>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-sm text-gray-500">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-sm text-gray-500">Successful</p>
              <p className="text-2xl font-bold text-green-600">{stats.successfulSessions}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failedSessions}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-sm text-gray-500">PRs Created</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalPRsCreated}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
        <div className="bg-white rounded-lg border">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No sessions found. Try testing the auto-fix system!
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sessions.map((session) => (
                <div key={session.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        Session {session.id}
                      </p>
                      <p className="text-sm text-gray-500">
                        Project: {session.projectId}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`
                        px-2 py-1 rounded-full text-xs font-medium
                        ${session.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          session.status === 'failed' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800'}
                      `}>
                        {session.status}
                      </span>
                      <div className="mt-2 flex gap-2 justify-end">
                        <button
                          disabled={session.status.toLowerCase() === 'cancelled' || session.status.toLowerCase() === 'completed'}
                          onClick={async () => {
                            await fetch(`/api/auto-fix/session/${session.id}/regenerate`, { method: 'POST' });
                            fetchData();
                          }}
                          className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
                        >
                          Regenerate
                        </button>
                        <button
                          disabled={session.status.toLowerCase() === 'cancelled' || session.status.toLowerCase() === 'completed'}
                          onClick={async () => {
                            await fetch(`/api/auto-fix/session/${session.id}/cancel`, { method: 'POST' });
                            fetchData();
                          }}
                          className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error Types Supported */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">🔧 Supported Error Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold text-gray-900 mb-3">🐛 JavaScript/TypeScript</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• TypeError (null/undefined access)</li>
              <li>• ReferenceError (undefined variables)</li>
              <li>• SyntaxError (missing brackets, semicolons)</li>
              <li>• Import/Export issues</li>
              <li>• Type annotation errors</li>
            </ul>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold text-gray-900 mb-3">⚙️ Build & Runtime</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Build compilation errors</li>
              <li>• Linting rule violations</li>
              <li>• Missing dependencies</li>
              <li>• Configuration issues</li>
              <li>• Test failures (basic patterns)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* System Health Check */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">🏥 System Health</h2>
        <div className="bg-white p-4 rounded-lg border">
          {healthCheck ? (
            <div>
              <div className={`p-3 rounded-lg mb-4 ${
                healthCheck.overall === 'ready' ? 'bg-green-50 border border-green-200' :
                healthCheck.overall === 'needs_setup' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center mb-2">
                  <span className={`h-3 w-3 rounded-full mr-2 ${
                    healthCheck.overall === 'ready' ? 'bg-green-500' :
                    healthCheck.overall === 'needs_setup' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></span>
                  <span className="font-medium">
                    {healthCheck.overall === 'ready' ? '✅ System Ready' :
                     healthCheck.overall === 'needs_setup' ? '⚠️ Setup Required' :
                     '❌ Configuration Issues'}
                  </span>
                </div>
                <ul className="text-sm space-y-1">
                  {healthCheck.recommendations.map((rec: string, i: number) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(healthCheck.checks).map(([key, check]: [string, { status: string; message: string }]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-3 w-3 rounded-full mr-2 ${
                        check.status === 'success' ? 'bg-green-500' :
                        check.status === 'warning' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}></div>
                      <span className="text-sm text-gray-700 capitalize">{key}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      check.status === 'success' ? 'bg-green-100 text-green-800' :
                      check.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {check.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">Loading health check...</div>
          )}
        </div>
      </div>

      {/* API Endpoints */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">🔌 API Endpoints</h2>
        <div className="bg-white p-4 rounded-lg border">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="font-mono text-sm">POST /api/github/auto-fix</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Trigger Auto Fix</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="font-mono text-sm">GET /api/auto-fix/stats</span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">View Statistics</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="font-mono text-sm">GET /api/auto-fix/sessions</span>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Session History</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}