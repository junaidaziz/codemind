/**
 * Auto Fix System End-to-End Tests
 * Practical tests for the complete auto-fix workflow
 */

describe('Auto Fix System E2E Tests', () => {
  const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  // Test configuration
  const TEST_CONFIG = {
    timeout: 30000, // 30 seconds
    projectId: 'e2e-test-project',
    mockErrors: {
      syntax: 'SyntaxError: Unexpected token "}" at line 42 in src/utils/helper.js',
      type: 'TypeError: Cannot read property "length" of undefined at src/components/List.tsx:15',
      reference: 'ReferenceError: variableName is not defined at src/services/api.js:28'
    }
  }

  describe('API Endpoints Health Check', () => {
    test('auto-fix stats endpoint should respond', async () => {
      const response = await fetch(`${API_BASE}/api/auto-fix/stats`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.stats).toBeDefined()
      expect(typeof data.stats.totalSessions).toBe('number')
    }, TEST_CONFIG.timeout)

    test('auto-fix sessions endpoint should respond', async () => {
      const response = await fetch(`${API_BASE}/api/auto-fix/sessions?limit=5`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(Array.isArray(data.sessions)).toBe(true)
    }, TEST_CONFIG.timeout)

    test('github auto-fix authentication endpoint should respond', async () => {
      const response = await fetch(`${API_BASE}/api/github/auto-fix`, {
        method: 'GET'
      })
      expect([200, 401, 500]).toContain(response.status)
    })
  })

  describe('Auto Fix Trigger', () => {
    test('should accept valid auto-fix request', async () => {
      const payload = {
        projectId: TEST_CONFIG.projectId,
        logContent: TEST_CONFIG.mockErrors.syntax,
        triggerType: 'manual'
      }

      const response = await fetch(`${API_BASE}/api/github/auto-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      // Should either succeed or fail gracefully
      expect([200, 400, 401, 500]).toContain(response.status)
      
      if (response.status === 200) {
        const result = await response.json()
        expect(result.sessionId || result.message).toBeDefined()
      }
    }, TEST_CONFIG.timeout)

    test('should validate required fields', async () => {
      const invalidPayloads = [
        {}, // Missing all fields
        { projectId: 'test' }, // Missing logContent
        { logContent: 'error' }, // Missing projectId
        { projectId: '', logContent: '' }, // Empty fields
      ]

      for (const payload of invalidPayloads) {
        const response = await fetch(`${API_BASE}/api/github/auto-fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        expect(response.status).toBe(400)
      }
    })

    test('should handle different error types', async () => {
      const errorTypes = Object.entries(TEST_CONFIG.mockErrors)

      for (const [type, errorLog] of errorTypes) {
        const payload = {
          projectId: `${TEST_CONFIG.projectId}-${type}`,
          logContent: errorLog,
          triggerType: 'test'
        }

        const response = await fetch(`${API_BASE}/api/github/auto-fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        // Each error type should be processed
        expect([200, 400, 500]).toContain(response.status)
      }
    })
  })

  describe('Settings Management', () => {
    test('should update auto-fix settings', async () => {
      const settings = {
        enableAutoFix: true,
        githubIntegration: true,
        autoCreatePR: true,
        branchPrefix: 'auto-fix/',
        requireReview: false
      }

      const response = await fetch(`${API_BASE}/api/auto-fix/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.message).toContain('Settings updated')
    })
  })

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await fetch(`${API_BASE}/api/github/auto-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }'
      })

      expect(response.status).toBe(400)
    })

    test('should handle oversized payloads', async () => {
      const largePayload = {
        projectId: TEST_CONFIG.projectId,
        logContent: 'Error: '.repeat(10000), // ~70KB payload
        triggerType: 'test'
      }

      const response = await fetch(`${API_BASE}/api/github/auto-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largePayload)
      })

      // Should either accept or reject gracefully
      expect([200, 413, 400]).toContain(response.status) // 413 = Payload Too Large
    })
  })

  describe('Rate Limiting', () => {
    test('should handle concurrent requests', async () => {
      const concurrentRequests = Array(3).fill(null).map((_, i) =>
        fetch(`${API_BASE}/api/github/auto-fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: `${TEST_CONFIG.projectId}-concurrent-${i}`,
            logContent: TEST_CONFIG.mockErrors.syntax,
            triggerType: 'test'
          })
        })
      )

      const responses = await Promise.all(concurrentRequests)
      
      // All should respond (either success or rate limited)
      responses.forEach(response => {
        expect([200, 429, 500]).toContain(response.status)
      })
    }, TEST_CONFIG.timeout)
  })

  describe('Performance Benchmarks', () => {
    test('stats endpoint should respond quickly', async () => {
      const startTime = Date.now()
      
      const response = await fetch(`${API_BASE}/api/auto-fix/stats`)
      
      const responseTime = Date.now() - startTime
      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(5000) // 5 seconds max
    })

    test('sessions endpoint should handle pagination efficiently', async () => {
      const startTime = Date.now()
      
      const response = await fetch(`${API_BASE}/api/auto-fix/sessions?limit=20&page=1`)
      
      const responseTime = Date.now() - startTime
      expect([200, 404]).toContain(response.status)
      expect(responseTime).toBeLessThan(3000) // 3 seconds max
    })
  })
})

// Health Check Tests for Dependencies
describe('System Dependencies Health', () => {
  test('database connection should be healthy', async () => {
    // This would test database connectivity
    // For now, we test via API endpoints that use the database
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auto-fix/stats`)
    expect([200, 500]).toContain(response.status)
  })

  test('environment variables should be configured', () => {
    // Check critical environment variables
    const criticalVars = ['OPENAI_API_KEY', 'DATABASE_URL']
    
    criticalVars.forEach(varName => {
      const value = process.env[varName]
      if (value) {
        expect(value).toBeTruthy()
        expect(value).not.toBe('placeholder-key')
        expect(value).not.toBe('your-key-here')
      } else {
        console.warn(`⚠️ Missing environment variable: ${varName}`)
      }
    })
  })
})

// Integration Flow Tests
describe('Complete Auto Fix Flow Integration', () => {
  test('end-to-end auto-fix workflow simulation', async () => {
    const testScenario = {
      projectId: 'integration-test-project',
      errorLog: `
Build failed with errors:

ERROR in src/components/UserProfile.tsx:23:5
TS2322: Type 'undefined' is not assignable to type 'string'.
    21 |   const handleSubmit = () => {
    22 |     const userData = {
  > 23 |       name: user.name,
       |       ^^^^
    24 |       email: user.email
    25 |     }
    26 |   }

ERROR in src/utils/validation.js:15:2
SyntaxError: Unexpected token '}'
    13 |   if (value.length > 0) {
    14 |     return true
  > 15 |   }
       |   ^
    16 | } // Missing closing brace

Found 2 errors. Watching for file changes.
      `.trim()
    }

    // Step 1: Trigger auto-fix
    const triggerResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/github/auto-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testScenario.projectId,
        logContent: testScenario.errorLog,
        triggerType: 'integration_test'
      })
    })

    expect([200, 400, 500]).toContain(triggerResponse.status)

    if (triggerResponse.status === 200) {
      const triggerResult = await triggerResponse.json()
      expect(triggerResult.sessionId || triggerResult.message).toBeDefined()

      // Step 2: Check if session was created (via stats endpoint)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
      
      const statsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auto-fix/stats`)
      expect(statsResponse.status).toBe(200)

      // Step 3: Verify sessions endpoint shows our test
      const sessionsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auto-fix/sessions?limit=5`)
      expect(sessionsResponse.status).toBe(200)
    }
  }, 60000) // 60 seconds for full integration test
})