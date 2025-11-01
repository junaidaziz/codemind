/**
 * Configurable Rule Weights System
 * 
 * Allows customization of:
 * - Risk factor weights (changeSize, fileCount, etc.)
 * - Severity scoring weights (critical, high, medium, low)
 * - Risk level thresholds
 * - Approval recommendation rules
 */

/**
 * Risk factor weight configuration
 */
export interface RiskFactorWeights {
  changeSize: number;      // Weight for lines changed (0-1)
  fileCount: number;        // Weight for number of files (0-1)
  criticalFiles: number;    // Weight for critical file modifications (0-1)
  complexity: number;       // Weight for code complexity (0-1)
  testCoverage: number;     // Weight for test coverage ratio (0-1)
}

/**
 * Risk score thresholds for determining risk levels
 */
export interface RiskThresholds {
  critical: number;  // Score >= this value → critical risk
  high: number;      // Score >= this value → high risk
  medium: number;    // Score >= this value → medium risk
  // Below medium → low risk
}

/**
 * Change size thresholds (lines changed)
 */
export interface ChangeSizeThresholds {
  small: number;      // < this value → low risk
  medium: number;     // < this value → medium risk
  large: number;      // < this value → high risk
  veryLarge: number;  // < this value → high risk, >= this value → critical risk
}

/**
 * File count thresholds
 */
export interface FileCountThresholds {
  few: number;        // <= this value → low risk
  moderate: number;   // <= this value → medium risk
  many: number;       // <= this value → high risk
  // > many → critical risk
}

/**
 * Severity scoring penalties
 */
export interface SeverityPenalties {
  critical: number;  // Penalty per critical issue
  high: number;      // Penalty per high issue
  medium: number;    // Penalty per medium issue
  low: number;       // Penalty per low issue
  info: number;      // Penalty per info issue
}

/**
 * Approval recommendation configuration
 */
export interface ApprovalRules {
  requestChangesOnCritical: boolean;    // Auto request changes if critical issues
  requestChangesOnHighRisk: boolean;    // Auto request changes if high risk score
  minCriticalIssuesForBlock: number;    // Minimum critical issues to block approval
  minHighIssuesForBlock: number;        // Minimum high issues to block approval
  commentOnMediumIssues: boolean;       // Comment if medium issues present
}

/**
 * Complete rule weights configuration
 */
export interface RuleWeightsConfig {
  name: string;
  description: string;
  riskFactorWeights: RiskFactorWeights;
  riskThresholds: RiskThresholds;
  changeSizeThresholds: ChangeSizeThresholds;
  fileCountThresholds: FileCountThresholds;
  severityPenalties: SeverityPenalties;
  approvalRules: ApprovalRules;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Default "Balanced" preset
 */
export const BALANCED_PRESET: RuleWeightsConfig = {
  name: 'balanced',
  description: 'Balanced risk assessment suitable for most projects',
  riskFactorWeights: {
    changeSize: 0.25,
    fileCount: 0.15,
    criticalFiles: 0.35,
    complexity: 0.15,
    testCoverage: 0.10,
  },
  riskThresholds: {
    critical: 80,
    high: 60,
    medium: 30,
  },
  changeSizeThresholds: {
    small: 50,
    medium: 200,
    large: 500,
    veryLarge: 1000,
  },
  fileCountThresholds: {
    few: 3,
    moderate: 10,
    many: 20,
  },
  severityPenalties: {
    critical: 25,
    high: 15,
    medium: 5,
    low: 2,
    info: 0,
  },
  approvalRules: {
    requestChangesOnCritical: true,
    requestChangesOnHighRisk: true,
    minCriticalIssuesForBlock: 1,
    minHighIssuesForBlock: 1,
    commentOnMediumIssues: true,
  },
};

/**
 * "Strict" preset - More conservative, catches more issues
 */
export const STRICT_PRESET: RuleWeightsConfig = {
  name: 'strict',
  description: 'Strict standards for critical projects (security, payments, etc.)',
  riskFactorWeights: {
    changeSize: 0.20,
    fileCount: 0.15,
    criticalFiles: 0.45,    // Higher weight for critical files
    complexity: 0.15,
    testCoverage: 0.05,
  },
  riskThresholds: {
    critical: 70,              // Lower threshold (stricter)
    high: 50,
    medium: 25,
  },
  changeSizeThresholds: {
    small: 30,                 // Smaller changes considered safe
    medium: 100,
    large: 300,
    veryLarge: 700,
  },
  fileCountThresholds: {
    few: 2,
    moderate: 5,
    many: 10,
  },
  severityPenalties: {
    critical: 30,              // Higher penalties
    high: 20,
    medium: 10,
    low: 5,
    info: 1,
  },
  approvalRules: {
    requestChangesOnCritical: true,
    requestChangesOnHighRisk: true,
    minCriticalIssuesForBlock: 1,
    minHighIssuesForBlock: 2,    // More lenient on high issues
    commentOnMediumIssues: true,
  },
};

/**
 * "Lenient" preset - More permissive for rapid development
 */
export const LENIENT_PRESET: RuleWeightsConfig = {
  name: 'lenient',
  description: 'Lenient standards for rapid development and prototyping',
  riskFactorWeights: {
    changeSize: 0.30,
    fileCount: 0.20,
    criticalFiles: 0.25,       // Lower weight for critical files
    complexity: 0.15,
    testCoverage: 0.10,
  },
  riskThresholds: {
    critical: 90,              // Higher threshold (more lenient)
    high: 70,
    medium: 40,
  },
  changeSizeThresholds: {
    small: 100,                // Larger changes considered safe
    medium: 500,
    large: 1000,
    veryLarge: 2000,
  },
  fileCountThresholds: {
    few: 5,
    moderate: 15,
    many: 30,
  },
  severityPenalties: {
    critical: 20,              // Lower penalties
    high: 10,
    medium: 3,
    low: 1,
    info: 0,
  },
  approvalRules: {
    requestChangesOnCritical: true,
    requestChangesOnHighRisk: false,  // Don't block on high risk
    minCriticalIssuesForBlock: 2,     // Need multiple critical issues
    minHighIssuesForBlock: 5,
    commentOnMediumIssues: false,     // Don't comment on medium
  },
};

/**
 * All available presets
 */
export const RULE_PRESETS: Record<string, RuleWeightsConfig> = {
  balanced: BALANCED_PRESET,
  strict: STRICT_PRESET,
  lenient: LENIENT_PRESET,
};

/**
 * Get a preset by name, fallback to balanced
 */
export function getPreset(name: string): RuleWeightsConfig {
  return RULE_PRESETS[name.toLowerCase()] || BALANCED_PRESET;
}

/**
 * Validate rule weights configuration
 */
export function validateRuleWeights(config: Partial<RuleWeightsConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate risk factor weights sum to ~1.0
  if (config.riskFactorWeights) {
    const weights = config.riskFactorWeights;
    const sum = weights.changeSize + weights.fileCount + weights.criticalFiles + 
                weights.complexity + weights.testCoverage;
    
    if (Math.abs(sum - 1.0) > 0.01) {
      errors.push(`Risk factor weights must sum to 1.0 (currently ${sum.toFixed(2)})`);
    }

    // Check individual weights are in valid range
    Object.entries(weights).forEach(([key, value]) => {
      if (value < 0 || value > 1) {
        errors.push(`${key} weight must be between 0 and 1 (currently ${value})`);
      }
    });
  }

  // Validate thresholds are ordered correctly
  if (config.riskThresholds) {
    const { critical, high, medium } = config.riskThresholds;
    if (critical <= high || high <= medium) {
      errors.push('Risk thresholds must be in descending order: critical > high > medium');
    }
    if (medium < 0 || critical > 100) {
      errors.push('Risk thresholds must be between 0 and 100');
    }
  }

  // Validate change size thresholds
  if (config.changeSizeThresholds) {
    const { small, medium, large, veryLarge } = config.changeSizeThresholds;
    if (small >= medium || medium >= large || large >= veryLarge) {
      errors.push('Change size thresholds must be in ascending order: small < medium < large < veryLarge');
    }
  }

  // Validate file count thresholds
  if (config.fileCountThresholds) {
    const { few, moderate, many } = config.fileCountThresholds;
    if (few >= moderate || moderate >= many) {
      errors.push('File count thresholds must be in ascending order: few < moderate < many');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge partial config with defaults
 */
export function mergeWithDefaults(
  partial: Partial<RuleWeightsConfig>,
  defaults: RuleWeightsConfig = BALANCED_PRESET
): RuleWeightsConfig {
  return {
    name: partial.name || defaults.name,
    description: partial.description || defaults.description,
    riskFactorWeights: { ...defaults.riskFactorWeights, ...partial.riskFactorWeights },
    riskThresholds: { ...defaults.riskThresholds, ...partial.riskThresholds },
    changeSizeThresholds: { ...defaults.changeSizeThresholds, ...partial.changeSizeThresholds },
    fileCountThresholds: { ...defaults.fileCountThresholds, ...partial.fileCountThresholds },
    severityPenalties: { ...defaults.severityPenalties, ...partial.severityPenalties },
    approvalRules: { ...defaults.approvalRules, ...partial.approvalRules },
    createdAt: partial.createdAt || new Date(),
    updatedAt: new Date(),
  };
}
