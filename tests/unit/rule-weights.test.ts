/**
 * Rule Weights Configuration Tests
 * 
 * Tests for configurable rule weights and presets
 */

import {
  BALANCED_PRESET,
  STRICT_PRESET,
  LENIENT_PRESET,
  validateRuleWeights,
  type RuleWeightsConfig,
} from '@/lib/code-review/rule-weights-config';

describe('Rule Weights Presets', () => {
  describe('BALANCED_PRESET', () => {
    it('should have all required properties', () => {
      expect(BALANCED_PRESET).toHaveProperty('riskFactorWeights');
      expect(BALANCED_PRESET).toHaveProperty('severityPenalties');
      expect(BALANCED_PRESET).toHaveProperty('changeSizeThresholds');
      expect(BALANCED_PRESET).toHaveProperty('fileCountThresholds');
    });

    it('should have valid risk factor weights', () => {
      const { riskFactorWeights } = BALANCED_PRESET;
      expect(riskFactorWeights.changeSize).toBeGreaterThan(0);
      expect(riskFactorWeights.fileCount).toBeGreaterThan(0);
      expect(riskFactorWeights.criticalFiles).toBeGreaterThan(0);
      expect(riskFactorWeights.complexity).toBeGreaterThan(0);
      expect(riskFactorWeights.testCoverage).toBeGreaterThan(0);
    });

    it('should have valid severity penalties', () => {
      const { severityPenalties } = BALANCED_PRESET;
      expect(severityPenalties.critical).toBeGreaterThan(severityPenalties.high);
      expect(severityPenalties.high).toBeGreaterThan(severityPenalties.medium);
      expect(severityPenalties.medium).toBeGreaterThan(severityPenalties.low);
      expect(severityPenalties.low).toBeGreaterThan(severityPenalties.info);
    });

    it('should have valid change size thresholds', () => {
      const { changeSizeThresholds } = BALANCED_PRESET;
      expect(changeSizeThresholds.small).toBeLessThan(changeSizeThresholds.medium);
      expect(changeSizeThresholds.medium).toBeLessThan(changeSizeThresholds.large);
      expect(changeSizeThresholds.large).toBeLessThan(changeSizeThresholds.veryLarge);
    });

    it('should have valid file count thresholds', () => {
      const { fileCountThresholds } = BALANCED_PRESET;
      expect(fileCountThresholds.few).toBeLessThan(fileCountThresholds.moderate);
      expect(fileCountThresholds.moderate).toBeLessThan(fileCountThresholds.many);
    });
  });

  describe('STRICT_PRESET', () => {
    it('should have higher penalties than BALANCED', () => {
      expect(STRICT_PRESET.severityPenalties.critical).toBeGreaterThan(
        BALANCED_PRESET.severityPenalties.critical
      );
      expect(STRICT_PRESET.riskFactorWeights.criticalFiles).toBeGreaterThan(
        BALANCED_PRESET.riskFactorWeights.criticalFiles
      );
    });

    it('should have stricter thresholds than BALANCED', () => {
      expect(STRICT_PRESET.changeSizeThresholds.small).toBeLessThan(
        BALANCED_PRESET.changeSizeThresholds.small
      );
      expect(STRICT_PRESET.fileCountThresholds.few).toBeLessThan(
        BALANCED_PRESET.fileCountThresholds.few
      );
    });
  });

  describe('LENIENT_PRESET', () => {
    it('should have lower penalties than BALANCED', () => {
      expect(LENIENT_PRESET.severityPenalties.critical).toBeLessThan(
        BALANCED_PRESET.severityPenalties.critical
      );
      expect(LENIENT_PRESET.riskFactorWeights.criticalFiles).toBeLessThan(
        BALANCED_PRESET.riskFactorWeights.criticalFiles
      );
    });

    it('should have more lenient thresholds than BALANCED', () => {
      expect(LENIENT_PRESET.changeSizeThresholds.small).toBeGreaterThan(
        BALANCED_PRESET.changeSizeThresholds.small
      );
      expect(LENIENT_PRESET.fileCountThresholds.few).toBeGreaterThan(
        BALANCED_PRESET.fileCountThresholds.few
      );
    });
  });
});

describe('validateRuleWeights', () => {
  it('should validate BALANCED_PRESET as valid', () => {
    const result = validateRuleWeights(BALANCED_PRESET);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate STRICT_PRESET as valid', () => {
    const result = validateRuleWeights(STRICT_PRESET);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate LENIENT_PRESET as valid', () => {
    const result = validateRuleWeights(LENIENT_PRESET);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject config with negative weights', () => {
    const invalidConfig: Partial<RuleWeightsConfig> = {
      riskFactorWeights: {
        changeSize: -1,
        fileCount: 0.15,
        criticalFiles: 0.35,
        complexity: 0.15,
        testCoverage: 0.10,
      },
    };
    const result = validateRuleWeights(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('changeSize weight must be between 0 and 1'))).toBe(true);
  });

  it('should not validate severity penalties (not part of validation)', () => {
    // Severity penalties are not validated by validateRuleWeights
    // This test documents that behavior
    const customConfig: Partial<RuleWeightsConfig> = {
      severityPenalties: {
        critical: -5,
        high: 4,
        medium: 3,
        low: 2,
        info: 1,
      },
    };
    const result = validateRuleWeights(customConfig);
    // Validation doesn't check severity penalties
    expect(result.valid).toBe(true);
  });

  it('should reject config with invalid threshold order (change size)', () => {
    const invalidConfig: Partial<RuleWeightsConfig> = {
      changeSizeThresholds: {
        small: 500,
        medium: 300, // Invalid: less than small
        large: 800,
        veryLarge: 1200,
      },
    };
    const result = validateRuleWeights(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Change size thresholds must be in ascending order'))).toBe(true);
  });

  it('should reject config with invalid threshold order (file count)', () => {
    const invalidConfig: Partial<RuleWeightsConfig> = {
      fileCountThresholds: {
        few: 5,
        moderate: 3, // Invalid: less than few
        many: 15,
      },
    };
    const result = validateRuleWeights(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('File count thresholds must be in ascending order'))).toBe(true);
  });

  it('should accept custom valid configuration', () => {
    const customConfig: Partial<RuleWeightsConfig> = {
      riskFactorWeights: {
        changeSize: 0.20,
        fileCount: 0.15,
        criticalFiles: 0.30,
        complexity: 0.20,
        testCoverage: 0.15,
      },
      changeSizeThresholds: {
        small: 100,
        medium: 400,
        large: 900,
        veryLarge: 1500,
      },
      fileCountThresholds: {
        few: 2,
        moderate: 8,
        many: 18,
      },
    };
    const result = validateRuleWeights(customConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('RiskScorer with custom config', () => {
  it('should use custom weights for risk calculation', async () => {
    const { RiskScorer } = await import('@/lib/code-review/risk-scorer');
    
    const customConfig: RuleWeightsConfig = {
      ...BALANCED_PRESET,
      riskFactorWeights: {
        changeSize: 0.50, // Higher weight
        fileCount: 0.10,
        criticalFiles: 0.20,
        complexity: 0.10,
        testCoverage: 0.10,
      },
    };

    const scorer = new RiskScorer(customConfig);
    
    const mockPRAnalysis = {
      prNumber: 123,
      title: 'Test PR',
      repository: 'test/repo',
      author: 'testuser',
      baseBranch: 'main',
      headBranch: 'feature',
      filesChanged: [
        {
          filename: 'test.ts',
          status: 'modified' as const,
          additions: 1000, // Large change
          deletions: 500,
          changes: 1500,
        },
      ],
      additions: 1000,
      deletions: 500,
      changedFiles: 1,
      commits: 1,
      description: 'Test',
      url: 'https://github.com/test/repo/pull/123',
      createdAt: new Date(),
      updatedAt: new Date(),
      totalAdditions: 1000,
      totalDeletions: 500,
      analyzedAt: new Date(),
    };

    const riskScore = await scorer.calculateRisk(mockPRAnalysis);
    
    // With high changeSize weight, the risk should be elevated
    expect(riskScore).toBeDefined();
    expect(riskScore.overall).toBeGreaterThan(0);
    expect(riskScore.level).toBeDefined();
    expect(riskScore.factors).toBeDefined();
    expect(Array.isArray(riskScore.factors)).toBe(true);
  });
});
