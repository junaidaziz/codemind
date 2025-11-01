/**
 * Unit tests for Default Compliance Rules
 */

import { defaultComplianceRules } from '../default-rules';

describe('Default Compliance Rules', () => {
  describe('Rule Structure', () => {
    test('should have at least 10 default rules', () => {
      expect(defaultComplianceRules.length).toBeGreaterThanOrEqual(10);
    });

    test('all default rules should have required fields', () => {
      defaultComplianceRules.forEach((rule) => {
        expect(rule.name).toBeDefined();
        expect(typeof rule.name).toBe('string');
        expect(rule.name.length).toBeGreaterThan(0);
        
        expect(rule.description).toBeDefined();
        expect(typeof rule.description).toBe('string');
        expect(rule.description.length).toBeGreaterThan(0);
        
        expect(rule.category).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(rule.ruleType).toBeDefined();
        expect(rule.condition).toBeDefined();
        expect(typeof rule.enabled).toBe('boolean');
      });
    });

    test('all rules should have valid action objects', () => {
      defaultComplianceRules.forEach((rule) => {
        if (rule.action) {
          expect(typeof rule.action).toBe('object');
          expect(rule.action.type).toBeDefined();
          expect(rule.action.message).toBeDefined();
        }
      });
    });

    test('all rules should have metadata', () => {
      defaultComplianceRules.forEach((rule) => {
        expect(rule.metadata).toBeDefined();
        expect(typeof rule.metadata).toBe('object');
        expect(rule.metadata?.category).toBeDefined();
        expect(rule.metadata?.tags).toBeDefined();
        expect(Array.isArray(rule.metadata?.tags)).toBe(true);
      });
    });
  });

  describe('Rule Categories', () => {
    test('should have valid categories', () => {
      const validCategories = [
        'SECURITY',
        'CODE_QUALITY',
        'PERFORMANCE',
        'ACCESSIBILITY',
        'DOCUMENTATION',
        'TESTING',
        'DEPENDENCIES',
        'LICENSE',
        'DATA_PRIVACY',
        'CUSTOM',
      ];
      
      defaultComplianceRules.forEach((rule) => {
        expect(validCategories).toContain(rule.category);
      });
    });

    test('should have rules for multiple categories', () => {
      const categories = new Set(defaultComplianceRules.map((rule) => rule.category));
      expect(categories.size).toBeGreaterThan(3);
      expect(categories).toContain('SECURITY');
      expect(categories).toContain('CODE_QUALITY');
    });

    test('should have distribution across categories', () => {
      const distribution = defaultComplianceRules.reduce((acc, rule) => {
        acc[rule.category] = (acc[rule.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // At least 3 categories should have rules
      expect(Object.keys(distribution).length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Rule Severities', () => {
    test('should have valid severity levels', () => {
      const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      defaultComplianceRules.forEach((rule) => {
        expect(validSeverities).toContain(rule.severity);
      });
    });

    test('should have critical security rules', () => {
      const criticalSecurityRules = defaultComplianceRules.filter(
        (rule) => rule.category === 'SECURITY' && rule.severity === 'CRITICAL'
      );
      expect(criticalSecurityRules.length).toBeGreaterThan(0);
    });

    test('critical rules should be for security or data privacy', () => {
      const criticalRules = defaultComplianceRules.filter(
        (rule) => rule.severity === 'CRITICAL'
      );
      criticalRules.forEach((rule) => {
        expect(['SECURITY', 'DATA_PRIVACY']).toContain(rule.category);
      });
    });

    test('should have balanced severity distribution', () => {
      const distribution = defaultComplianceRules.reduce((acc, rule) => {
        acc[rule.severity] = (acc[rule.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Should have at least 2 severity levels
      expect(Object.keys(distribution).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Rule Types', () => {
    test('should have valid rule types', () => {
      const validTypes = [
        'CODE_QUALITY',
        'SECURITY',
        'PERFORMANCE',
        'STYLE',
        'DOCUMENTATION',
        'TESTING',
        'DEPENDENCY',
        'CUSTOM',
      ];
      
      defaultComplianceRules.forEach((rule) => {
        expect(validTypes).toContain(rule.ruleType);
      });
    });
  });

  describe('Specific Rules', () => {
    test('should have "No Hardcoded Secrets" rule', () => {
      const rule = defaultComplianceRules.find(
        (r) => r.name === 'No Hardcoded Secrets'
      );
      expect(rule).toBeDefined();
      expect(rule?.severity).toBe('CRITICAL');
      expect(rule?.category).toBe('SECURITY');
    });

    test('should have SQL injection prevention rule', () => {
      const rule = defaultComplianceRules.find(
        (r) => r.name === 'SQL Injection Prevention'
      );
      expect(rule).toBeDefined();
      expect(rule?.severity).toBe('CRITICAL');
    });

    test('should have accessibility rule', () => {
      const accessibilityRules = defaultComplianceRules.filter(
        (r) => r.category === 'ACCESSIBILITY'
      );
      expect(accessibilityRules.length).toBeGreaterThan(0);
    });

    test('should have testing rule', () => {
      const testingRules = defaultComplianceRules.filter(
        (r) => r.category === 'TESTING'
      );
      expect(testingRules.length).toBeGreaterThan(0);
    });

    test('should have performance rule', () => {
      const performanceRules = defaultComplianceRules.filter(
        (r) => r.category === 'PERFORMANCE'
      );
      expect(performanceRules.length).toBeGreaterThan(0);
    });
  });

  describe('Rule Conditions', () => {
    test('all conditions should have a type', () => {
      defaultComplianceRules.forEach((rule) => {
        expect(rule.condition).toHaveProperty('type');
        expect(typeof rule.condition.type).toBe('string');
      });
    });

    test('pattern_match rules should have patterns', () => {
      const patternRules = defaultComplianceRules.filter(
        (r) => r.condition.type === 'pattern_match'
      );
      patternRules.forEach((rule) => {
        expect(rule.condition.patterns).toBeDefined();
        expect(Array.isArray(rule.condition.patterns)).toBe(true);
      });
    });
  });

  describe('Rule Actions', () => {
    test('all actions should have valid types', () => {
      const validActionTypes = ['block', 'warn', 'notify'];
      defaultComplianceRules.forEach((rule) => {
        if (rule.action) {
          expect(validActionTypes).toContain(rule.action.type);
        }
      });
    });

    test('critical rules should have block or warn actions', () => {
      const criticalRules = defaultComplianceRules.filter(
        (r) => r.severity === 'CRITICAL'
      );
      criticalRules.forEach((rule) => {
        expect(rule.action).toBeDefined();
        expect(['block', 'warn']).toContain(rule.action?.type);
      });
    });
  });
});
