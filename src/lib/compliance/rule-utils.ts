import { ComplianceRuleService } from './rule-service';
import { defaultComplianceRules } from './default-rules';

/**
 * Initialize default compliance rules for a project or organization
 */
export async function initializeDefaultRules(
  userId: string,
  options?: {
    organizationId?: string;
    projectId?: string;
    skipExisting?: boolean;
  }
) {
  const results = {
    created: 0,
    skipped: 0,
    errors: 0,
    rules: [] as string[],
  };

  for (const ruleTemplate of defaultComplianceRules) {
    try {
      // Check if rule already exists (by name)
      if (options?.skipExisting) {
        const existing = await ComplianceRuleService.listRules({
          organizationId: options.organizationId,
          projectId: options.projectId,
          limit: 1,
        });

        const alreadyExists = existing.rules.some(
          (r) => r.name === ruleTemplate.name
        );

        if (alreadyExists) {
          results.skipped++;
          continue;
        }
      }

      // Create the rule
      const rule = await ComplianceRuleService.createRule({
        name: ruleTemplate.name,
        description: ruleTemplate.description,
        category: ruleTemplate.category,
        severity: ruleTemplate.severity,
        ruleType: ruleTemplate.ruleType,
        enabled: ruleTemplate.enabled,
        condition: ruleTemplate.condition as Record<string, unknown>,
        action: ruleTemplate.action as Record<string, unknown>,
        metadata: ruleTemplate.metadata as Record<string, unknown>,
        organizationId: options?.organizationId,
        projectId: options?.projectId,
        createdBy: userId,
      });

      results.created++;
      results.rules.push(rule.id);
    } catch (error) {
      console.error(`Error creating rule ${ruleTemplate.name}:`, error);
      results.errors++;
    }
  }

  return results;
}

/**
 * Get rule statistics grouped by various dimensions
 */
export async function getRuleInsights(
  organizationId?: string,
  projectId?: string
) {
  const stats = await ComplianceRuleService.getRuleStats(
    organizationId,
    projectId
  );

  // Calculate insights
  const insights = {
    totalRules: stats.total,
    enabledRules: stats.enabled,
    disabledRules: stats.disabled,
    enablementRate:
      stats.total > 0 ? (stats.enabled / stats.total) * 100 : 0,
    severityDistribution: stats.bySeverity,
    categoryDistribution: stats.byCategory,
    typeDistribution: stats.byType,
    recommendations: [] as string[],
  };

  // Generate recommendations
  if (insights.enablementRate < 50) {
    insights.recommendations.push(
      'Consider enabling more compliance rules to improve code quality'
    );
  }

  const criticalRules = stats.bySeverity['CRITICAL'] || 0;
  if (criticalRules < 3) {
    insights.recommendations.push(
      'Add more critical security rules to protect your codebase'
    );
  }

  const testingRules = stats.byCategory['TESTING'] || 0;
  if (testingRules < 2) {
    insights.recommendations.push(
      'Add testing rules to ensure adequate test coverage'
    );
  }

  return insights;
}

/**
 * Validate rule conditions
 */
export function validateRuleCondition(condition: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!condition.type) {
    errors.push('Condition must have a type');
  }

  const validTypes = [
    'pattern_match',
    'ast_analysis',
    'file_analysis',
    'license_check',
    'coverage_check',
    'bundle_size',
  ];

  if (condition.type && !validTypes.includes(condition.type as string)) {
    errors.push(
      `Invalid condition type: ${condition.type}. Must be one of: ${validTypes.join(', ')}`
    );
  }

  // Type-specific validation
  if (condition.type === 'pattern_match') {
    if (!condition.patterns) {
      errors.push('pattern_match condition must have patterns array');
    }
  }

  if (condition.type === 'license_check') {
    if (!condition.allowedLicenses && !condition.blockedLicenses) {
      errors.push(
        'license_check condition must have allowedLicenses or blockedLicenses'
      );
    }
  }

  if (condition.type === 'coverage_check') {
    if (typeof condition.minimumCoverage !== 'number') {
      errors.push('coverage_check condition must have minimumCoverage number');
    }
  }

  if (condition.type === 'bundle_size') {
    if (typeof condition.maxSize !== 'number') {
      errors.push('bundle_size condition must have maxSize number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export rules to JSON format
 */
export async function exportRules(
  organizationId?: string,
  projectId?: string
) {
  const { rules } = await ComplianceRuleService.listRules({
    organizationId,
    projectId,
    limit: 1000, // Get all rules
  });

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    scope: {
      organizationId: organizationId || null,
      projectId: projectId || null,
    },
    rules: rules.map((rule) => ({
      name: rule.name,
      description: rule.description,
      category: rule.category,
      severity: rule.severity,
      ruleType: rule.ruleType,
      enabled: rule.enabled,
      condition: rule.condition,
      action: rule.action,
      metadata: rule.metadata,
    })),
  };
}

/**
 * Import rules from JSON format
 */
export async function importRules(
  data: {
    rules: Array<{
      name: string;
      description: string;
      category: string;
      severity?: string;
      ruleType?: string;
      enabled?: boolean;
      condition: Record<string, unknown>;
      action?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }>;
  },
  userId: string,
  options?: {
    organizationId?: string;
    projectId?: string;
    skipExisting?: boolean;
  }
) {
  const results = {
    imported: 0,
    skipped: 0,
    errors: 0,
    errorMessages: [] as string[],
  };

  for (const ruleData of data.rules) {
    try {
      // Validate condition
      const validation = validateRuleCondition(ruleData.condition);
      if (!validation.valid) {
        results.errors++;
        results.errorMessages.push(
          `Rule "${ruleData.name}": ${validation.errors.join(', ')}`
        );
        continue;
      }

      // Check if rule already exists
      if (options?.skipExisting) {
        const existing = await ComplianceRuleService.listRules({
          organizationId: options.organizationId,
          projectId: options.projectId,
          limit: 1000,
        });

        const alreadyExists = existing.rules.some(
          (r) => r.name === ruleData.name
        );

        if (alreadyExists) {
          results.skipped++;
          continue;
        }
      }

      // Create the rule
      await ComplianceRuleService.createRule({
        name: ruleData.name,
        description: ruleData.description,
        category: ruleData.category,
        severity: ruleData.severity,
        ruleType: ruleData.ruleType,
        enabled: ruleData.enabled,
        condition: ruleData.condition,
        action: ruleData.action,
        metadata: ruleData.metadata,
        organizationId: options?.organizationId,
        projectId: options?.projectId,
        createdBy: userId,
      });

      results.imported++;
    } catch (error) {
      results.errors++;
      results.errorMessages.push(
        `Rule "${ruleData.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return results;
}
