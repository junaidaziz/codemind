/**
 * PR Risk Scoring System
 * 
 * Analyzes pull requests to assign risk scores based on:
 * - Critical files affected (auth, payment, database)
 * - Number of files and lines changed
 * - Code complexity
 * - Test coverage
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskScore {
  level: RiskLevel;
  score: number; // 0-100
  factors: RiskFactor[];
  recommendations: string[];
}

export interface RiskFactor {
  category: string;
  severity: RiskLevel;
  description: string;
  weight: number;
}

interface PRMetrics {
  filesChanged: string[];
  linesAdded: number;
  linesRemoved: number;
  testCoverage?: number;
}

// Critical file patterns that increase risk
const CRITICAL_PATTERNS = [
  { pattern: /auth|login|signin|signup|password|token/i, severity: 'CRITICAL', weight: 30 },
  { pattern: /payment|billing|invoice|charge|stripe/i, severity: 'CRITICAL', weight: 30 },
  { pattern: /migration|schema\.prisma|database/i, severity: 'HIGH', weight: 25 },
  { pattern: /security|permission|rbac|acl/i, severity: 'HIGH', weight: 25 },
  { pattern: /api\/|route\.ts/i, severity: 'MEDIUM', weight: 15 },
  { pattern: /config|env|settings/i, severity: 'MEDIUM', weight: 15 },
  { pattern: /middleware|interceptor/i, severity: 'MEDIUM', weight: 15 },
];

/**
 * Calculate risk score for a PR
 */
export function calculatePRRisk(metrics: PRMetrics): RiskScore {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // Factor 1: Critical files affected
  const criticalFiles = analyzeCriticalFiles(metrics.filesChanged);
  if (criticalFiles.length > 0) {
    factors.push(...criticalFiles);
    totalScore += criticalFiles.reduce((sum, f) => sum + f.weight, 0);
  }

  // Factor 2: Change magnitude
  const magnitude = analyzeChangeMagnitude(metrics);
  factors.push(magnitude);
  totalScore += magnitude.weight;

  // Factor 3: File count
  const fileCount = analyzeFileCount(metrics.filesChanged.length);
  factors.push(fileCount);
  totalScore += fileCount.weight;

  // Factor 4: Test coverage
  if (metrics.testCoverage !== undefined) {
    const coverage = analyzeTestCoverage(metrics.testCoverage);
    factors.push(coverage);
    totalScore += coverage.weight;
  }

  // Normalize score to 0-100
  const normalizedScore = Math.min(100, totalScore);

  // Determine risk level
  const level = getRiskLevel(normalizedScore);

  // Generate recommendations
  const recommendations = generateRecommendations(factors, level);

  return {
    level,
    score: normalizedScore,
    factors,
    recommendations,
  };
}

/**
 * Analyze if critical files are affected
 */
function analyzeCriticalFiles(files: string[]): RiskFactor[] {
  const factors: RiskFactor[] = [];
  
  for (const file of files) {
    for (const { pattern, severity, weight } of CRITICAL_PATTERNS) {
      if (pattern.test(file)) {
        factors.push({
          category: 'Critical File',
          severity: severity as RiskLevel,
          description: `Modifies critical file: ${file}`,
          weight,
        });
        break; // Only count each file once
      }
    }
  }

  return factors;
}

/**
 * Analyze change magnitude (lines added/removed)
 */
function analyzeChangeMagnitude(metrics: PRMetrics): RiskFactor {
  const totalLines = metrics.linesAdded + metrics.linesRemoved;

  if (totalLines > 1000) {
    return {
      category: 'Change Magnitude',
      severity: 'HIGH',
      description: `Large change: ${totalLines} lines modified`,
      weight: 20,
    };
  } else if (totalLines > 500) {
    return {
      category: 'Change Magnitude',
      severity: 'MEDIUM',
      description: `Medium change: ${totalLines} lines modified`,
      weight: 15,
    };
  } else if (totalLines > 200) {
    return {
      category: 'Change Magnitude',
      severity: 'MEDIUM',
      description: `Moderate change: ${totalLines} lines modified`,
      weight: 10,
    };
  } else {
    return {
      category: 'Change Magnitude',
      severity: 'LOW',
      description: `Small change: ${totalLines} lines modified`,
      weight: 5,
    };
  }
}

/**
 * Analyze number of files changed
 */
function analyzeFileCount(fileCount: number): RiskFactor {
  if (fileCount > 20) {
    return {
      category: 'File Count',
      severity: 'HIGH',
      description: `${fileCount} files changed`,
      weight: 15,
    };
  } else if (fileCount > 10) {
    return {
      category: 'File Count',
      severity: 'MEDIUM',
      description: `${fileCount} files changed`,
      weight: 10,
    };
  } else if (fileCount > 5) {
    return {
      category: 'File Count',
      severity: 'LOW',
      description: `${fileCount} files changed`,
      weight: 5,
    };
  } else {
    return {
      category: 'File Count',
      severity: 'LOW',
      description: `${fileCount} files changed`,
      weight: 2,
    };
  }
}

/**
 * Analyze test coverage
 */
function analyzeTestCoverage(coverage: number): RiskFactor {
  if (coverage < 50) {
    return {
      category: 'Test Coverage',
      severity: 'HIGH',
      description: `Low test coverage: ${coverage.toFixed(1)}%`,
      weight: 20,
    };
  } else if (coverage < 70) {
    return {
      category: 'Test Coverage',
      severity: 'MEDIUM',
      description: `Moderate test coverage: ${coverage.toFixed(1)}%`,
      weight: 10,
    };
  } else if (coverage < 85) {
    return {
      category: 'Test Coverage',
      severity: 'LOW',
      description: `Good test coverage: ${coverage.toFixed(1)}%`,
      weight: 0,
    };
  } else {
    return {
      category: 'Test Coverage',
      severity: 'LOW',
      description: `Excellent test coverage: ${coverage.toFixed(1)}%`,
      weight: -5, // Negative weight reduces risk
    };
  }
}

/**
 * Determine risk level from score
 */
function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Generate recommendations based on risk factors
 */
function generateRecommendations(factors: RiskFactor[], level: RiskLevel): string[] {
  const recommendations: string[] = [];

  // Check for critical files
  const hasCriticalFiles = factors.some(f => f.category === 'Critical File');
  if (hasCriticalFiles) {
    recommendations.push('⚠️ Request review from senior developer or security team');
    recommendations.push('🔒 Verify all authentication and authorization checks');
  }

  // Check for large changes
  const hasMagnitude = factors.find(f => f.category === 'Change Magnitude');
  if (hasMagnitude && hasMagnitude.severity !== 'LOW') {
    recommendations.push('📊 Consider splitting into smaller PRs');
    recommendations.push('✅ Ensure comprehensive testing for all changes');
  }

  // Check for test coverage
  const coverage = factors.find(f => f.category === 'Test Coverage');
  if (coverage && coverage.severity !== 'LOW') {
    recommendations.push('🧪 Add more unit and integration tests');
    recommendations.push('📈 Aim for at least 80% test coverage');
  }

  // Check many files
  const fileCount = factors.find(f => f.category === 'File Count');
  if (fileCount && fileCount.severity === 'HIGH') {
    recommendations.push('🔍 Review each file change carefully');
    recommendations.push('📝 Document major changes in PR description');
  }

  // General recommendations by level
  if (level === 'CRITICAL') {
    recommendations.push('🚨 Deploy during low-traffic hours');
    recommendations.push('📱 Have rollback plan ready');
    recommendations.push('👥 Pair review with at least 2 senior developers');
  } else if (level === 'HIGH') {
    recommendations.push('⏰ Allow extra time for review');
    recommendations.push('🔄 Test in staging environment thoroughly');
  }

  return recommendations;
}

/**
 * Get risk color for UI display
 */
export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-500';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-500';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-500';
    case 'LOW':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-500';
  }
}

/**
 * Get risk emoji for display
 */
export function getRiskEmoji(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL':
      return '🔴';
    case 'HIGH':
      return '🟠';
    case 'MEDIUM':
      return '🟡';
    case 'LOW':
      return '🟢';
  }
}
