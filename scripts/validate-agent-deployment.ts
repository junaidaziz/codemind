#!/usr/bin/env node
/**
 * Agent Service Deployment Validation Script
 * Tests the standalone agent service deployment and integration
 */

import { AgentServiceClient } from '../src/lib/agent-service-client';
import { AgentRouter } from '../src/lib/agent-router';

interface ValidationResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
}

class DeploymentValidator {
  private results: ValidationResult[] = [];
  private agentServiceUrl: string;
  private client: AgentServiceClient;

  constructor(agentServiceUrl?: string) {
    this.agentServiceUrl = agentServiceUrl || process.env.AGENT_SERVICE_URL || 'http://localhost:3001';
    this.client = new AgentServiceClient({
      baseUrl: this.agentServiceUrl,
      timeout: 10000, // 10 second timeout for validation
      retries: 1,
    });
  }

  /**
   * Run all validation tests
   */
  async runValidation(): Promise<void> {
    console.log('🧪 Starting Agent Service Deployment Validation');
    console.log(`📡 Testing service at: ${this.agentServiceUrl}`);
    console.log('');

    // Test basic connectivity
    await this.testConnectivity();
    
    // Test health endpoint
    await this.testHealthEndpoint();
    
    // Test capabilities endpoint
    await this.testCapabilitiesEndpoint();
    
    // Test agent processing
    await this.testAgentProcessing();
    
    // Test streaming
    await this.testStreaming();
    
    // Test error handling
    await this.testErrorHandling();
    
    // Test rate limiting (if enabled)
    await this.testRateLimiting();
    
    // Test metrics endpoint
    await this.testMetrics();
    
    // Test agent router integration
    await this.testAgentRouter();
    
    // Print results
    this.printResults();
  }

  /**
   * Test basic connectivity to the service
   */
  private async testConnectivity(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(this.agentServiceUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      // Any response (even 404) means the service is reachable
      this.results.push({
        test: 'Service Connectivity',
        status: 'pass',
        message: `Service reachable (HTTP ${response.status})`,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        test: 'Service Connectivity',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Connection failed',
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Test health endpoint
   */
  private async testHealthEndpoint(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const health = await this.client.checkHealth();
      
      if (health.status === 'healthy') {
        this.results.push({
          test: 'Health Endpoint',
          status: 'pass',
          message: 'Service is healthy',
          details: {
            uptime: Math.round(health.uptime / 1000),
            memoryUsagePercent: health.memoryUsage.percentage,
            activeConnections: health.activeConnections,
          },
          duration: Date.now() - startTime,
        });
      } else {
        this.results.push({
          test: 'Health Endpoint',
          status: 'warning',
          message: 'Service reports unhealthy status',
          details: health,
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      this.results.push({
        test: 'Health Endpoint',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Health check failed',
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Test capabilities endpoint
   */
  private async testCapabilitiesEndpoint(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const capabilities = await this.client.getCapabilities();
      
      const expectedCommands = ['chat', 'analyze_code', 'summarize_project'];
      const hasRequiredCommands = expectedCommands.every(cmd => 
        capabilities.commands.includes(cmd)
      );
      
      this.results.push({
        test: 'Capabilities Endpoint',
        status: hasRequiredCommands ? 'pass' : 'warning',
        message: hasRequiredCommands ? 'All required capabilities available' : 'Some capabilities missing',
        details: {
          availableCommands: capabilities.commands,
          tools: capabilities.tools,
          version: capabilities.version,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        test: 'Capabilities Endpoint',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Capabilities check failed',
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Test agent processing with a simple request
   */
  private async testAgentProcessing(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const testRequest = {
        id: crypto.randomUUID(),
        command: 'chat' as const,
        projectId: 'test-project',
        userId: 'test-user',
        message: 'Hello, this is a test message. Please respond briefly.',
      };
      
      const response = await this.client.processRequest(testRequest);
      
      if (response.response && response.response.length > 0) {
        this.results.push({
          test: 'Agent Processing',
          status: 'pass',
          message: 'Agent processed request successfully',
          details: {
            responseLength: response.response.length,
            executionTime: response.executionTimeMs,
            toolsUsed: response.toolsUsed.length,
            tokenUsage: response.tokenUsage?.totalTokens,
          },
          duration: Date.now() - startTime,
        });
      } else {
        this.results.push({
          test: 'Agent Processing',
          status: 'fail',
          message: 'Agent returned empty response',
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      this.results.push({
        test: 'Agent Processing',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Agent processing failed',
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Test streaming functionality
   */
  private async testStreaming(): Promise<void> {
    const startTime = Date.now();
    let chunkCount = 0;
    let hasContent = false;
    let completed = false;
    
    try {
      const testRequest = {
        id: crypto.randomUUID(),
        command: 'chat' as const,
        projectId: 'test-project',
        userId: 'test-user',
        message: 'Count from 1 to 5 and explain each number.',
      };
      
      for await (const chunk of this.client.processRequestStream(testRequest)) {
        chunkCount++;
        
        if (chunk.type === 'content' && chunk.content) {
          hasContent = true;
        }
        
        if (chunk.type === 'done') {
          completed = true;
          break;
        }
        
        if (chunk.type === 'error') {
          throw new Error(chunk.error || 'Stream error');
        }
        
        // Prevent infinite loops
        if (chunkCount > 100) {
          break;
        }
      }
      
      if (hasContent && completed) {
        this.results.push({
          test: 'Streaming',
          status: 'pass',
          message: 'Streaming works correctly',
          details: {
            chunkCount,
            hasContent,
            completed,
          },
          duration: Date.now() - startTime,
        });
      } else {
        this.results.push({
          test: 'Streaming',
          status: 'warning',
          message: 'Streaming incomplete',
          details: {
            chunkCount,
            hasContent,
            completed,
          },
          duration: Date.now() - startTime,
        });
      }
    } catch (error) {
      this.results.push({
        test: 'Streaming',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Streaming failed',
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Send invalid request to test error handling
      const invalidRequest = {
        command: 'invalid_command' as 'chat', // Force invalid command for testing
        projectId: '',
        userId: '',
        message: '',
      };
      
      try {
        await this.client.processRequest(invalidRequest);
        this.results.push({
          test: 'Error Handling',
          status: 'warning',
          message: 'Service accepted invalid request',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        // This is expected - service should reject invalid requests
        if (error instanceof Error && error.message.includes('validation')) {
          this.results.push({
            test: 'Error Handling',
            status: 'pass',
            message: 'Service correctly rejects invalid requests',
            duration: Date.now() - startTime,
          });
        } else {
          this.results.push({
            test: 'Error Handling',
            status: 'warning',
            message: 'Unexpected error type',
            details: { error: error instanceof Error ? error.message : String(error) },
            duration: Date.now() - startTime,
          });
        }
      }
    } catch (error) {
      this.results.push({
        test: 'Error Handling',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Error handling test failed',
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Test rate limiting (send multiple rapid requests)
   */
  private async testRateLimiting(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const promises = Array.from({ length: 10 }, (_, i) => 
        this.client.processRequest({
          id: crypto.randomUUID(),
          command: 'chat',
          projectId: 'test-project',
          userId: `test-user-${i}`,
          message: `Test message ${i}`,
        })
      );
      
      const results = await Promise.allSettled(promises);
      const rejected = results.filter(r => r.status === 'rejected');
      const rateLimited = rejected.filter(r => 
        r.reason?.message?.includes('rate limit') || 
        r.reason?.message?.includes('429')
      );
      
      if (rateLimited.length > 0) {
        this.results.push({
          test: 'Rate Limiting',
          status: 'pass',
          message: 'Rate limiting is working',
          details: {
            totalRequests: promises.length,
            rateLimited: rateLimited.length,
          },
          duration: Date.now() - startTime,
        });
      } else {
        this.results.push({
          test: 'Rate Limiting',
          status: 'warning',
          message: 'Rate limiting may not be configured',
          details: {
            totalRequests: promises.length,
            allSucceeded: results.every(r => r.status === 'fulfilled'),
          },
          duration: Date.now() - startTime,
        });
      }
    } catch {
      this.results.push({
        test: 'Rate Limiting',
        status: 'warning',
        message: 'Could not test rate limiting',
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Test metrics endpoint
   */
  private async testMetrics(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const metrics = await this.client.getMetrics();
      
      this.results.push({
        test: 'Metrics Endpoint',
        status: 'pass',
        message: 'Metrics available',
        details: {
          uptime: Math.round(metrics.uptime / 1000),
          totalRequests: metrics.totalRequests,
          memoryUsedMB: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
          version: metrics.version,
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        test: 'Metrics Endpoint',
        status: 'warning',
        message: error instanceof Error ? error.message : 'Metrics not available',
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Test agent router integration
   */
  private async testAgentRouter(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test agent router with both standalone and local modes
      const router = new AgentRouter();
      
      // Test health check
      const health = await router.checkHealth();
      
      // Test service info
      const serviceInfo = await router.getServiceInfo();
      
      this.results.push({
        test: 'Agent Router',
        status: 'pass',
        message: 'Agent router integration working',
        details: {
          activeService: serviceInfo.activeService,
          capabilities: serviceInfo.capabilities,
          localAgentStatus: health.localAgent.status,
          standaloneAgentStatus: health.standaloneAgent?.status || 'not-configured',
        },
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        test: 'Agent Router',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Agent router test failed',
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Print validation results
   */
  private printResults(): void {
    console.log('\n📊 Validation Results\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const passed = this.results.filter(r => r.status === 'pass').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const total = this.results.length;
    
    for (const result of this.results) {
      const icon = result.status === 'pass' ? '✅' : 
                   result.status === 'warning' ? '⚠️' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      
      console.log(`${icon} ${result.test}: ${result.message}${duration}`);
      
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📈 Summary: ${passed}/${total} passed, ${warnings} warnings, ${failed} failed`);
    
    if (failed > 0) {
      console.log('❌ Deployment validation FAILED');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('⚠️  Deployment validation PASSED with warnings');
      process.exit(0);
    } else {
      console.log('✅ Deployment validation PASSED');
      process.exit(0);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const agentServiceUrl = process.argv[2];
  const validator = new DeploymentValidator(agentServiceUrl);
  
  validator.runValidation().catch((error) => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  });
}