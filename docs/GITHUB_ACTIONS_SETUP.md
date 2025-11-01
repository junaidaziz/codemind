# GitHub Actions Integration Guide

This guide explains how to set up GitHub Actions to automatically run AI code reviews on pull requests.

## Overview

The GitHub Actions workflow (`ai-code-review.yml`) automatically:
1. Triggers on PR open, sync, or reopen events
2. Calls your CodeMind API to analyze the PR
3. Posts a summary comment with risk level and score
4. Optionally fails the workflow on CRITICAL risk

## Setup Instructions

### 1. Deploy CodeMind

First, ensure CodeMind is deployed and accessible:
- Production deployment (e.g., Vercel, Railway)
- Public API endpoint URL
- Database and authentication configured

### 2. Generate API Key

Create an API key for GitHub Actions:
```sql
-- In your database, create a service account token
INSERT INTO api_keys (key, name, created_at)
VALUES ('codemind_gh_actions_xyz123', 'GitHub Actions', NOW());
```

> **Note:** In a future release, API keys will be manageable via the UI.

### 3. Configure Repository Secrets

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

```bash
CODEMIND_API_URL="https://your-codemind-instance.vercel.app"
CODEMIND_API_KEY="your-api-key-here"
CODEMIND_PROJECT_ID="your-project-id"  # Optional, defaults to 'default'
```

### 4. Copy Workflow File

Copy `.github/workflows/ai-code-review.yml` to your target repository:

```bash
# From your project repo
mkdir -p .github/workflows
curl -o .github/workflows/ai-code-review.yml \
  https://raw.githubusercontent.com/junaidaziz/codemind/main/.github/workflows/ai-code-review.yml
```

Or manually create the file with the contents from this repository.

### 5. Customize Workflow (Optional)

You can customize the workflow behavior:

#### Fail on Critical Risk
Uncomment the last line in the "Check Risk Threshold" step:
```yaml
- name: Check Risk Threshold
  if: steps.review.outputs.risk-level == 'CRITICAL'
  run: |
    echo "::warning::Critical risk detected in this PR!"
    exit 1  # Uncomment to fail workflow
```

#### Add Custom Risk Thresholds
Modify the threshold check:
```yaml
- name: Check Risk Threshold
  if: |
    steps.review.outputs.risk-level == 'CRITICAL' ||
    (steps.review.outputs.risk-level == 'HIGH' && steps.review.outputs.overall-score < 60)
  run: |
    echo "::error::Risk threshold exceeded!"
    exit 1
```

#### Filter by File Patterns
Add path filters to trigger only on specific files:
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - 'src/**'
      - 'lib/**'
      - '!**/*.test.ts'  # Exclude test files
```

## Testing the Workflow

1. Create a test PR in your repository
2. The workflow should trigger automatically
3. Check the Actions tab for execution logs
4. Verify the AI review comment appears on the PR

## Troubleshooting

### Workflow Not Triggering
- Check that `pull_request` events are enabled in Settings → Actions → General
- Verify workflow file is in `.github/workflows/` directory
- Ensure file is valid YAML (no syntax errors)

### API Call Failures
- Verify `CODEMIND_API_URL` is correct and accessible
- Check `CODEMIND_API_KEY` is valid
- Review workflow logs for error messages
- Ensure GitHub token has `pull-requests: write` permission

### Missing Comments
- Verify workflow has `issues: write` permission
- Check GitHub App permissions if using a custom token
- Review logs for `createComment` errors

## Rate Limits

Be aware of rate limits:
- **GitHub Actions:** 1000 API requests per hour per repository
- **CodeMind API:** Depends on your deployment (check logs for rate limit headers)
- **OpenAI API:** 3-10 RPM on free tier, higher on paid

Consider adding workflow throttling for busy repositories:
```yaml
concurrency:
  group: ai-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true  # Cancel previous run if new commit pushed
```

## Best Practices

1. **Start with warnings only** - Don't fail workflows immediately
2. **Monitor costs** - Track OpenAI API usage in production
3. **Set appropriate thresholds** - Adjust risk levels based on your team's needs
4. **Exclude generated files** - Use path filters to skip auto-generated code
5. **Review manually** - AI is a tool, not a replacement for human reviewers

## Example PR Comment

When the workflow completes successfully, it posts a comment like:

```markdown
## ✅ AI Code Review Complete

**Risk Level:** MEDIUM  
**Overall Score:** 85/100

[View Detailed Review](https://your-codemind.vercel.app/reviews/clx123abc)

---
*Automated review powered by CodeMind AI*
```

## Next Steps

- [ ] Set up branch protection rules to require AI review
- [ ] Configure Slack/Discord notifications for high-risk PRs
- [ ] Create custom dashboards tracking review metrics over time
- [ ] Integrate with your CI/CD pipeline for deployment gating

## Support

For issues or questions:
- GitHub Issues: https://github.com/junaidaziz/codemind/issues
- Documentation: https://github.com/junaidaziz/codemind/docs
