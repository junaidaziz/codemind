# Vercel → GitHub Webhook Relay API

## Overview

The `/api/vercel-hook` endpoint serves as a relay between Vercel webhook events and GitHub Actions. When Vercel deployments fail, this endpoint automatically triggers the "Auto Fix Vercel Build Failures" GitHub Actions workflow.

## Endpoint Details

- **URL**: `/api/vercel-hook`
- **Method**: `POST` only
- **Content-Type**: `application/json`

## Setup Instructions

### 1. Configure Environment Variables

Add the following environment variable to your deployment:

```bash
GITHUB_TOKEN=your_github_personal_access_token_here
```

**GitHub Token Requirements:**
- Must have `repo` scope for repository access
- Must have `actions:write` permission for triggering workflows
- Can be created at: https://github.com/settings/tokens

### 2. Configure Vercel Webhook

In your Vercel project settings:

1. Go to **Settings** → **Git** → **Deploy Hooks**
2. Add a new webhook with:
   - **URL**: `https://your-domain.com/api/vercel-hook`
   - **Events**: Select "Deployment Error" or "All Events"
   - **Method**: POST

### 3. Optional: Add Webhook Secret (Future Enhancement)

For additional security, you can configure a webhook secret in Vercel and add signature verification to the endpoint.

## Webhook Payload Types

### Deployment Error Event

The endpoint listens specifically for deployment error events:

```json
{
  "id": "webhook-id",
  "type": "deployment.error",
  "createdAt": 1697123456789,
  "data": {
    "deployment": {
      "id": "deployment-id",
      "url": "https://project-xyz.vercel.app",
      "name": "project-name",
      "state": "ERROR",
      "projectId": "project-id",
      "org": {
        "id": "org-id",
        "name": "org-name"
      }
    },
    "project": {
      "id": "project-id",
      "name": "project-name"
    }
  }
}
```

## API Responses

### Success (Deployment Error)
```json
{
  "ok": true,
  "message": "Deployment error relayed to GitHub Actions",
  "dispatched": true
}
```

### Success (Other Events)
```json
{
  "ok": true,
  "message": "Webhook event 'deployment.ready' processed",
  "dispatched": false
}
```

### Error Responses

#### Invalid JSON
```json
{
  "ok": false,
  "error": "Invalid JSON payload"
}
```

#### Missing Required Fields
```json
{
  "ok": false,
  "error": "Invalid payload: missing type or id"
}
```

#### GitHub API Error
```json
{
  "ok": false,
  "error": "Failed to trigger GitHub workflow"
}
```

#### Method Not Allowed
```json
{
  "ok": false,
  "error": "Method not allowed. Use POST."
}
```

## GitHub Actions Integration

When a deployment error is detected, the endpoint triggers a GitHub Actions workflow via the `repository_dispatch` event:

### Dispatch Payload
```json
{
  "event_type": "vercel-build-failed",
  "client_payload": {
    "deployment_id": "deployment-id",
    "project_id": "project-id",
    "timestamp": 1697123456789
  }
}
```

### GitHub API Call Details
- **URL**: `https://api.github.com/repos/junaidaziz/codemind/dispatches`
- **Method**: POST
- **Headers**:
  - `Accept: application/vnd.github.everest-preview+json`
  - `Authorization: token ${GITHUB_TOKEN}`
  - `Content-Type: application/json`
  - `User-Agent: CodeMind-Vercel-Webhook-Relay/1.0`

## Workflow Trigger

The GitHub Actions workflow `auto-fix-vercel-failures.yml` is configured to listen for the `repository_dispatch` event:

```yaml
on:
  repository_dispatch:
    types: [vercel-build-failed]
```

When triggered, it will:
1. Fetch the latest failed Vercel deployment logs
2. Analyze them using OpenAI GPT-4o-mini
3. Generate an automated analysis report
4. Commit the results to the repository
5. Create GitHub issues for repeated failures

## Security Considerations

### Current Implementation
- Basic request validation (JSON parsing, required fields)
- GitHub token authentication for API calls
- Comprehensive logging for audit trails

### Future Enhancements
- Vercel signature verification using webhook secret
- Rate limiting to prevent abuse
- IP whitelist for Vercel webhook IPs
- Request size limits

## Logging

The endpoint provides comprehensive logging for:
- Incoming webhook events (type, ID, timestamp)
- GitHub API calls (success/failure, response codes)
- Error conditions (parsing errors, missing tokens, network failures)
- Performance metrics (request duration)

All logs are structured with relevant context for debugging and monitoring.

## Testing

### Manual Testing

You can test the endpoint manually using curl:

```bash
# Test with a deployment error event
curl -X POST https://your-domain.com/api/vercel-hook \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-webhook-id",
    "type": "deployment.error",
    "createdAt": 1697123456789,
    "data": {
      "deployment": {
        "id": "test-deployment-id",
        "state": "ERROR",
        "projectId": "test-project-id",
        "org": {"id": "test-org", "name": "test-org"},
        "url": "https://test.vercel.app",
        "name": "test-deployment"
      }
    }
  }'

# Test with a non-error event
curl -X POST https://your-domain.com/api/vercel-hook \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-webhook-id",
    "type": "deployment.ready",
    "createdAt": 1697123456789,
    "data": {
      "deployment": {
        "id": "test-deployment-id",
        "state": "READY"
      }
    }
  }'
```

### Testing with Vercel CLI

You can simulate webhook events using Vercel CLI:

```bash
# Trigger a test webhook (if configured in Vercel)
vercel env add WEBHOOK_TEST_URL https://your-domain.com/api/vercel-hook
```

## Troubleshooting

### Common Issues

1. **GitHub Token Not Set**
   - Error: "Failed to trigger GitHub workflow"
   - Solution: Ensure `GITHUB_TOKEN` environment variable is set

2. **Invalid GitHub Token**
   - Error: GitHub API returns 401/403
   - Solution: Verify token has correct permissions (`repo`, `actions:write`)

3. **Webhook Not Triggering**
   - Check Vercel webhook configuration
   - Verify endpoint URL is accessible
   - Check webhook event types are configured correctly

4. **GitHub Actions Not Running**
   - Verify workflow file exists and has correct trigger
   - Check repository settings allow Actions
   - Ensure workflow is on the default branch

### Debug Information

Check the application logs for detailed information about webhook processing:
- Incoming webhook events
- GitHub API calls and responses
- Any error conditions or failures

## Architecture

```
Vercel Deployment Error
         ↓
    Vercel Webhook
         ↓
  /api/vercel-hook
         ↓
   GitHub API Call
    (repository_dispatch)
         ↓
   GitHub Actions Workflow
    (auto-fix-vercel-failures)
         ↓
   Automated Analysis & Reports
```

This creates a fully automated pipeline from deployment failure to analysis and reporting, enabling rapid response to build issues.