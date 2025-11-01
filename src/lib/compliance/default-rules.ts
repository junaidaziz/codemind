/**
 * Default compliance rules for common security and quality checks
 * Note: Patterns are stored as strings and should be converted to RegExp when evaluating rules
 */
export const defaultComplianceRules = [
  {
    name: 'No Hardcoded Secrets',
    description: 'Detect hardcoded API keys, passwords, and secrets in code',
    category: 'SECURITY',
    severity: 'CRITICAL',
    ruleType: 'SECURITY',
    enabled: true,
    condition: {
      type: 'pattern_match',
      patterns: [
        'api[_-]?key\\s*=\\s*[\'"][^\'"]+[\'"]',
        'password\\s*=\\s*[\'"][^\'"]+[\'"]',
        'secret\\s*=\\s*[\'"][^\'"]+[\'"]',
        'token\\s*=\\s*[\'"][^\'"]+[\'"]',
        'AKIA[0-9A-Z]{16}',  // AWS Access Key
      ],
      patternFlags: 'i', // case-insensitive
      excludePatterns: [
        'example',
        'placeholder',
        'your_',
        'xxx+',
      ],
      excludePatternFlags: 'i',
    },
    action: {
      type: 'block',
      message: 'Hardcoded secrets detected. Use environment variables instead.',
    },
    metadata: {
      category: 'Security',
      tags: ['secrets', 'credentials', 'security'],
      documentation: 'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password',
    },
  },
  {
    name: 'SQL Injection Prevention',
    description: 'Detect potential SQL injection vulnerabilities',
    category: 'SECURITY',
    severity: 'CRITICAL',
    ruleType: 'SECURITY',
    enabled: true,
    condition: {
      type: 'pattern_match',
      patterns: [
        'execute\\s*\\(\\s*[\'"].*\\$\\{',
        'query\\s*\\(\\s*[\'"].*\\$\\{',
        'raw\\s*\\(\\s*[\'"].*\\$\\{',
      ],
      patternFlags: 'i',
    },
    action: {
      type: 'warn',
      message: 'Potential SQL injection risk. Use parameterized queries.',
    },
    metadata: {
      category: 'Security',
      tags: ['sql', 'injection', 'database'],
      documentation: 'https://owasp.org/www-community/attacks/SQL_Injection',
    },
  },
  {
    name: 'No Console Logs in Production',
    description: 'Prevent console.log statements in production code',
    category: 'CODE_QUALITY',
    severity: 'LOW',
    ruleType: 'CODE_QUALITY',
    enabled: true,
    condition: {
      type: 'pattern_match',
      patterns: ['console\\.(log|debug|info)'],
      filePatterns: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx'],
      excludePatterns: ['\\.test\\.', '\\.spec\\.'],
    },
    action: {
      type: 'warn',
      message: 'Remove console statements before deploying to production.',
    },
    metadata: {
      category: 'Code Quality',
      tags: ['logging', 'debugging', 'production'],
    },
  },
  {
    name: 'Require Error Handling',
    description: 'Ensure async functions have proper error handling',
    category: 'CODE_QUALITY',
    severity: 'MEDIUM',
    ruleType: 'CODE_QUALITY',
    enabled: true,
    condition: {
      type: 'ast_analysis',
      check: 'async_without_try_catch',
    },
    action: {
      type: 'warn',
      message: 'Async functions should have try-catch blocks for error handling.',
    },
    metadata: {
      category: 'Code Quality',
      tags: ['error-handling', 'async', 'reliability'],
    },
  },
  {
    name: 'Dependency Version Pinning',
    description: 'Ensure dependencies use fixed versions, not ranges',
    category: 'DEPENDENCIES',
    severity: 'MEDIUM',
    ruleType: 'DEPENDENCY',
    enabled: true,
    condition: {
      type: 'file_analysis',
      files: ['package.json'],
      check: 'version_ranges',
      patterns: ['\\^', '~', '\\*'],
    },
    action: {
      type: 'warn',
      message: 'Pin dependency versions to avoid unexpected updates.',
    },
    metadata: {
      category: 'Dependencies',
      tags: ['dependencies', 'versions', 'reproducibility'],
    },
  },
  {
    name: 'MIT License Compliance',
    description: 'Ensure all dependencies have compatible licenses',
    category: 'LICENSE',
    severity: 'HIGH',
    ruleType: 'DEPENDENCY',
    enabled: true,
    condition: {
      type: 'license_check',
      allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
      blockedLicenses: ['GPL-3.0', 'AGPL-3.0'],
    },
    action: {
      type: 'block',
      message: 'Dependency license is not compatible with project license.',
    },
    metadata: {
      category: 'License',
      tags: ['license', 'legal', 'compliance'],
    },
  },
  {
    name: 'Required Test Coverage',
    description: 'Ensure minimum test coverage for modified files',
    category: 'TESTING',
    severity: 'MEDIUM',
    ruleType: 'TESTING',
    enabled: true,
    condition: {
      type: 'coverage_check',
      minimumCoverage: 70,
      scope: 'modified_files',
    },
    action: {
      type: 'warn',
      message: 'Test coverage below threshold. Add tests for modified code.',
    },
    metadata: {
      category: 'Testing',
      tags: ['testing', 'coverage', 'quality'],
    },
  },
  {
    name: 'Accessible Components',
    description: 'Ensure React components follow accessibility guidelines',
    category: 'ACCESSIBILITY',
    severity: 'MEDIUM',
    ruleType: 'CODE_QUALITY',
    enabled: true,
    condition: {
      type: 'pattern_match',
      patterns: [
        '<img(?![^>]*alt=)',  // img without alt
        '<button(?![^>]*aria-label)',  // button without aria-label
        '<input(?![^>]*aria-label)',  // input without aria-label
      ],
      filePatterns: ['**/*.tsx', '**/*.jsx'],
    },
    action: {
      type: 'warn',
      message: 'Add accessibility attributes to interactive elements.',
    },
    metadata: {
      category: 'Accessibility',
      tags: ['a11y', 'accessibility', 'wcag'],
      documentation: 'https://www.w3.org/WAI/WCAG21/quickref/',
    },
  },
  {
    name: 'No Sensitive Data in Logs',
    description: 'Prevent logging of sensitive user data',
    category: 'DATA_PRIVACY',
    severity: 'CRITICAL',
    ruleType: 'SECURITY',
    enabled: true,
    condition: {
      type: 'pattern_match',
      patterns: [
        'log.*password',
        'log.*credit.*card',
        'log.*ssn',
        'log.*email.*password',
      ],
      patternFlags: 'i',
    },
    action: {
      type: 'block',
      message: 'Do not log sensitive user data. This violates privacy regulations.',
    },
    metadata: {
      category: 'Data Privacy',
      tags: ['privacy', 'gdpr', 'pii', 'security'],
      documentation: 'https://gdpr.eu/',
    },
  },
  {
    name: 'Performance Budget',
    description: 'Ensure bundle size stays within limits',
    category: 'PERFORMANCE',
    severity: 'MEDIUM',
    ruleType: 'PERFORMANCE',
    enabled: true,
    condition: {
      type: 'bundle_size',
      maxSize: 500000,  // 500KB
      scope: 'main_bundle',
    },
    action: {
      type: 'warn',
      message: 'Bundle size exceeds performance budget. Optimize imports.',
    },
    metadata: {
      category: 'Performance',
      tags: ['performance', 'bundle-size', 'optimization'],
    },
  },
];
