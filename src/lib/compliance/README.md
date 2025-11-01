# Compliance Foundation

The Compliance Foundation provides a comprehensive system for managing code compliance rules, running automated audits, and enforcing quality standards across your codebase.

## Features

### 1. Core Rule Management

Manage compliance rules at global, organization, or project level:

- **Create, update, delete rules** via API
- **Rule categories**: Security, Code Quality, Performance, Accessibility, Testing, Dependencies, License, Data Privacy
- **Severity levels**: Low, Medium, High, Critical
- **Flexible conditions**: Pattern matching, AST analysis, file checks, license verification
- **Actions**: Block, warn, or notify on violations

### 2. Authentication & Authorization

- All endpoints require authentication via NextAuth
- Role-based access control for compliance management
- Audit logging of all compliance actions

### 3. AI-Powered Auditing

- **Automated analysis** of compliance violations
- **AI-generated insights** for violations and overall audit reports
- **Smart suggestions** for fixing compliance issues
- **Compliance scoring** from 0-100

### 4. PR-Based Trigger Pipeline

- **GitHub Actions workflow** that triggers on PR events
- **Automatic compliance checks** on every pull request
- **PR comments** with compliance report and score
- **Configurable thresholds** for blocking critical violations

## API Endpoints

### Rules Management

#### List Rules
```
GET /api/compliance/rules?category=SECURITY&enabled=true
```

Response:
```json
{
  "rules": [
    {
      "id": "rule_123",
      "name": "No Hardcoded Secrets",
      "category": "SECURITY",
      "severity": "CRITICAL",
      "enabled": true,
      "openViolationsCount": 3
    }
  ],
  "total": 10,
  "hasMore": false
}
```

#### Create Rule
```
POST /api/compliance/rules
Content-Type: application/json

{
  "name": "Custom Security Rule",
  "description": "Detect custom security patterns",
  "category": "SECURITY",
  "severity": "HIGH",
  "condition": {
    "type": "pattern_match",
    "patterns": ["..."]
  }
}
```

#### Get Rule
```
GET /api/compliance/rules/{id}
```

#### Update Rule
```
PATCH /api/compliance/rules/{id}
Content-Type: application/json

{
  "enabled": false
}
```

#### Delete Rule
```
DELETE /api/compliance/rules/{id}
```

### Audits

#### Create Audit
```
POST /api/compliance/audits
Content-Type: application/json

{
  "projectId": "proj_123",
  "prNumber": 42,
  "commitSha": "abc123",
  "triggerType": "PR_EVENT"
}
```

#### List Audits
```
GET /api/compliance/audits?projectId=proj_123&status=COMPLETED
```

#### Get Audit Details
```
GET /api/compliance/audits/{id}
```

Response:
```json
{
  "id": "audit_123",
  "projectId": "proj_123",
  "status": "COMPLETED",
  "rulesChecked": 10,
  "violationsFound": 3,
  "criticalCount": 1,
  "highCount": 2,
  "overallScore": 75.5,
  "aiInsights": "...",
  "violations": [...]
}
```

### Statistics

#### Get Compliance Stats
```
GET /api/compliance/stats?projectId=proj_123&days=30
```

Response:
```json
{
  "rules": {
    "total": 15,
    "enabled": 12,
    "bySeverity": { "CRITICAL": 3, "HIGH": 5, "MEDIUM": 4 }
  },
  "audits": {
    "total": 50,
    "completed": 45,
    "failed": 5,
    "averageScore": 82.3
  },
  "overallHealth": {
    "score": 85,
    "status": "GOOD"
  }
}
```

## GitHub Workflow Setup

### Prerequisites

Add these secrets to your GitHub repository:

1. Go to **Settings → Secrets and Variables → Actions**
2. Add the following secrets:
   - `CODEMIND_API_URL`: Your CodeMind API URL (e.g., `https://api.codemind.dev`)
   - `CODEMIND_API_KEY`: Your API key for authentication
   - `CODEMIND_PROJECT_ID`: Your project ID

### Workflow Configuration

The compliance check workflow (`.github/workflows/compliance-check.yml`) runs automatically on:
- Pull request opened
- Pull request synchronized (new commits)
- Pull request reopened

It will:
1. Trigger a compliance audit via the API
2. Wait for audit completion (up to 5 minutes)
3. Post results as a PR comment
4. Optionally fail the workflow on critical violations

### Customization

To fail the workflow on critical violations, uncomment the last line in the workflow:

```yaml
- name: Check Critical Violations
  if: steps.wait-audit.outputs.critical && steps.wait-audit.outputs.critical != '0'
  run: |
    echo "::error::Critical compliance violations detected!"
    exit 1  # Uncomment to fail the workflow
```

## Default Rules

The system comes with 10 pre-configured rules covering:

1. **No Hardcoded Secrets** (CRITICAL)
2. **SQL Injection Prevention** (CRITICAL)
3. **No Console Logs in Production** (LOW)
4. **Require Error Handling** (MEDIUM)
5. **Dependency Version Pinning** (MEDIUM)
6. **MIT License Compliance** (HIGH)
7. **Required Test Coverage** (MEDIUM)
8. **Accessible Components** (MEDIUM)
9. **No Sensitive Data in Logs** (CRITICAL)
10. **Performance Budget** (MEDIUM)

See `src/lib/compliance/default-rules.ts` for full definitions.

## Database Schema

### ComplianceRule
- Stores rule definitions with conditions and actions
- Supports global, organization, and project scopes
- Tracks creator and timestamps

### ComplianceViolation
- Records individual rule violations
- Links to source rule and location (file, line)
- Includes AI analysis and suggestions
- Trackable status: Open, Acknowledged, Resolved, Ignored, False Positive

### ComplianceAudit
- Audit execution records
- Aggregates violation counts by severity
- Stores AI-generated insights and compliance score
- Tracks duration and completion status

## AI Analysis

The system uses OpenAI's GPT models to:

1. **Analyze violations**: Explain why a violation occurred and how to fix it
2. **Generate audit insights**: Provide executive summary of compliance status
3. **Calculate compliance scores**: Weighted scoring based on violation severity
4. **Suggest fixes**: Actionable recommendations for resolving issues

## Usage Examples

### Running a Manual Audit

```typescript
const response = await fetch('/api/compliance/audits', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'my-project',
    triggerType: 'MANUAL'
  })
});

const audit = await response.json();
console.log(`Audit ${audit.id} started`);
```

### Creating a Custom Rule

```typescript
const rule = {
  name: 'No TODO Comments in Production',
  description: 'Ensure all TODO comments are resolved before deployment',
  category: 'CODE_QUALITY',
  severity: 'LOW',
  condition: {
    type: 'pattern_match',
    patterns: [/\/\/\s*TODO/i],
    filePatterns: ['src/**/*.ts']
  },
  action: {
    type: 'warn',
    message: 'Resolve TODO comments before merging'
  }
};

await fetch('/api/compliance/rules', {
  method: 'POST',
  body: JSON.stringify(rule)
});
```

### Monitoring Compliance Health

```typescript
const stats = await fetch('/api/compliance/stats?projectId=my-project&days=7');
const { overallHealth } = await stats.json();

console.log(`Compliance Score: ${overallHealth.score}/100`);
console.log(`Status: ${overallHealth.status}`);
```

## Future Enhancements

- [ ] Custom rule engine with plugin support
- [ ] Real-time violation notifications
- [ ] Compliance trends and historical analysis
- [ ] Integration with other CI/CD platforms
- [ ] Machine learning for violation prediction
- [ ] Compliance report exports (PDF, CSV)
- [ ] Team collaboration on violation resolution
- [ ] SLA tracking for violation remediation

## Support

For issues or questions about the compliance system:
- Create an issue on GitHub
- Contact the development team
- Check the documentation at `/docs/compliance`
