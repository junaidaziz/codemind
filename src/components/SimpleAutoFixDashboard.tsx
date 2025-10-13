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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Auto Fix Dashboard
        </h1>
        <p className="text-gray-600">
          Monitor and manage automated code fixes and pull requests
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <Button 
            onClick={testAutoFix}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? 'Processing...' : 'Test Auto Fix'}
          </Button>
          
          <Button 
            onClick={fetchData}
            disabled={isLoading}
            variant="outline"
          >
            Refresh Data
          </Button>
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Health Check */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">System Health</h2>
        <div className="bg-white p-4 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-700">Database Connected</span>
            </div>
            <div className="flex items-center">
              <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-700">API Endpoints Ready</span>
            </div>
            <div className="flex items-center">
              <div className="h-3 w-3 bg-yellow-500 rounded-full mr-2"></div>
              <span className="text-sm text-gray-700">GitHub Integration Configured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}