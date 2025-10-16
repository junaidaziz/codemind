# Vercel Deployment Integration Guide

## Overview
This guide explains how to integrate Vercel deployments with CodeMind's auto-fix system to automatically handle build failures.

## Components

### 1. Vercel Log Fetcher Script
**Location:** `/scripts/fetch-vercel-logs.js`

Fetches deployment logs from Vercel API for analysis and auto-fix triggering.

#### Usage

```bash
# Fetch latest 5 failed deployments
npm run fetch-vercel-logs:errors

# Fetch and automatically trigger auto-fix
npm run fetch-vercel-logs:auto-fix

# Fetch specific deployment
node scripts/fetch-vercel-logs.js --deployment-id dpl_xxx

# Save logs to file
node scripts/fetch-vercel-logs.js --status error --output logs/vercel-errors.json

# Get help
node scripts/fetch-vercel-logs.js --help
```

#### Options

- `--deployment-id <id>` - Specific deployment ID to fetch logs for
- `--project-id <id>` - Project ID (defaults to `VERCEL_PROJECT_ID` env var)
- `--status <status>` - Filter by status (error, ready, building)
- `--limit <number>` - Number of deployments to fetch (default: 10)
- `--auto-fix` - Automatically trigger auto-fix for failed builds
- `--output <file>` - Save logs to file (JSON format)

### 2. Vercel Webhook Handler
**Location:** `/src/app/api/webhooks/vercel-deployment/route.ts`

Receives real-time webhook events from Vercel and automatically triggers auto-fix for failed deployments.

#### Setup Webhook in Vercel

1. Go to your Vercel project settings
2. Navigate to "Webhooks" section
3. Click "Add Webhook"
4. Configure:
   - **URL:** `https://your-domain.com/api/webhooks/vercel-deployment`
   - **Events:** Select:
     - `deployment.created`
     - `deployment.succeeded`
     - `deployment.failed`
     - `deployment.error`
   - **Secret:** Set a secure secret (will use `VERCEL_WEBHOOK_SECRET`)

#### Webhook Flow

```
Vercel Deployment Fails
      ↓
Webhook Event Sent
      ↓
/api/webhooks/vercel-deployment
      ↓
Fetch Deployment Logs
      ↓
Trigger Auto-Fix API
      ↓
Auto-Fix Session Created
      ↓
Analysis & PR Generation
```

### 3. CI/CD Pipeline Integration
**Location:** `/.github/workflows/ci-cd.yml`

Existing GitHub Actions workflow with comprehensive checks:
- ✅ Linting (ESLint)
- ✅ Type checking (TypeScript)
- ✅ Unit tests (Jest)
- ✅ E2E tests (Playwright)
- ✅ Security scans (Snyk, Trivy)
- ✅ Build verification
- ✅ Automated deployments

## Environment Variables

### Required
```env
# Vercel API Configuration
VERCEL_TOKEN=your_vercel_token_here
VERCEL_PROJECT_ID=prj_xxxxx
VERCEL_TEAM_ID=team_xxxxx  # Optional, for team projects

# Webhook Security
VERCEL_WEBHOOK_SECRET=your_webhook_secret_here

# Application URL (for webhook callbacks)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Getting Vercel Tokens

1. **Vercel Token:**
   - Go to https://vercel.com/account/tokens
   - Click "Create Token"
   - Name it "CodeMind CI/CD"
   - Copy the token

2. **Project ID:**
   - Go to your project settings in Vercel
   - Find "Project ID" in General settings
   - Or use: `vercel inspect <deployment-url>`

3. **Team ID:**
   - Go to team settings in Vercel
   - Find "Team ID"
   - Only needed if project is under a team

## Testing

### Test Webhook Endpoint
```bash
curl http://localhost:3000/api/webhooks/vercel-deployment
```

Expected response:
```json
{
  "success": true,
  "data": {
    "message": "Vercel deployment webhook endpoint is active",
    "timestamp": "2025-10-16T..."
  }
}
```

### Test Log Fetcher
```bash
# Test fetching logs (dry run)
npm run fetch-vercel-logs:errors

# Test with auto-fix (requires local server)
npm run dev  # In one terminal
npm run fetch-vercel-logs:auto-fix  # In another terminal
```

### Test CI/CD Pipeline
```bash
# Run local tests
npm run test:all

# Trigger CI/CD (push to branch)
git checkout -b test/ci-cd
git commit --allow-empty -m "test: CI/CD pipeline"
git push origin test/ci-cd
```

## Monitoring

### View Webhook Logs
```bash
# Check application logs
tail -f logs/app.log | grep "vercel-webhook"

# Or use Vercel dashboard
# Go to: Deployments → [Deployment] → Functions → Logs
```

### View Auto-Fix Sessions
```bash
# API endpoint
curl http://localhost:3000/api/auto-fix/sessions?limit=10

# Or check database
npx prisma studio
# Navigate to AutoFixSession table
```

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook configuration in Vercel
2. Verify `VERCEL_WEBHOOK_SECRET` is set
3. Check application logs for signature verification errors
4. Test endpoint is accessible: `curl https://your-domain.com/api/webhooks/vercel-deployment`

### Auto-Fix Not Triggering

1. Verify webhook is receiving events (check logs)
2. Check deployment logs are being fetched
3. Verify auto-fix API is accessible
4. Check `AutoFixSession` table for sessions
5. Review activity logs for errors

### Log Fetcher Fails

1. Verify `VERCEL_TOKEN` is valid
2. Check `VERCEL_PROJECT_ID` matches your project
3. Ensure token has correct permissions
4. Check Vercel API rate limits

## Best Practices

### Security
- ✅ Always verify webhook signatures
- ✅ Use environment variables for secrets
- ✅ Implement rate limiting for webhook endpoint
- ✅ Log all webhook events for audit trail

### Performance
- ✅ Process webhooks asynchronously
- ✅ Queue auto-fix requests to avoid overload
- ✅ Implement exponential backoff for retries
- ✅ Cache deployment logs when possible

### Monitoring
- ✅ Set up alerts for webhook failures
- ✅ Track auto-fix success rates
- ✅ Monitor deployment failure patterns
- ✅ Review and act on recurring issues

## Integration Examples

### Manual Trigger from CLI
```bash
# Fetch latest failed deployment and trigger auto-fix
npm run fetch-vercel-logs:auto-fix

# Fetch specific deployment
node scripts/fetch-vercel-logs.js \
  --deployment-id dpl_123456 \
  --auto-fix \
  --output logs/deployment-123456.json
```

### Scheduled Check (Cron)
```bash
# Add to crontab for hourly checks
0 * * * * cd /path/to/codemind && npm run fetch-vercel-logs:auto-fix
```

### CI/CD Integration
```yaml
# .github/workflows/check-vercel.yml
name: Check Vercel Deployments
on:
  schedule:
    - cron: '0 * * * *'  # Every hour

jobs:
  check-deployments:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run fetch-vercel-logs:auto-fix
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

## API Reference

### Webhook Payload Example
```json
{
  "id": "evt_123",
  "type": "deployment.failed",
  "createdAt": 1697500000000,
  "payload": {
    "deployment": {
      "id": "dpl_123",
      "url": "my-app-abc123.vercel.app",
      "state": "ERROR",
      "meta": {
        "githubCommitRef": "main",
        "githubCommitSha": "abc123",
        "githubCommitMessage": "fix: update feature"
      }
    },
    "project": {
      "id": "prj_123",
      "name": "my-app"
    }
  }
}
```

### Log Fetcher Output Example
```json
{
  "timestamp": "2025-10-16T12:00:00Z",
  "deployments": [
    {
      "id": "dpl_123",
      "url": "my-app-abc123.vercel.app",
      "state": "ERROR",
      "errorCount": 3
    }
  ],
  "errors": [
    {
      "deploymentId": "dpl_123",
      "deploymentUrl": "my-app-abc123.vercel.app",
      "errorCount": 3,
      "errors": [
        {
          "timestamp": "2025-10-16T11:55:00Z",
          "message": "Type error: Property 'foo' does not exist",
          "type": "stderr"
        }
      ]
    }
  ]
}
```

## Support

For issues or questions:
1. Check application logs
2. Review this documentation
3. Check GitHub issues
4. Contact team lead

---

**Created:** 16 October 2025  
**Status:** ✅ Production Ready  
**Maintainer:** CodeMind Team
