# 🤖 Auto Fix Vercel Build Failures - GitHub Actions Integration

This GitHub Actions workflow automatically analyzes failed Vercel deployments and provides AI-powered fix suggestions.

## 🎯 Features

- ✅ **Automatic Trigger** - Runs on pushes to main/develop branches
- ✅ **Manual Trigger** - Can be run via `workflow_dispatch`
- ✅ **Vercel API Integration** - Fetches latest failed deployment logs
- ✅ **AI Analysis** - Uses our enhanced TypeScript analyzer script
- ✅ **Auto Commit** - Commits analysis results to repository
- ✅ **GitHub Issues** - Creates issues for repeated failures (3+ times)
- ✅ **Comprehensive Reporting** - Human-readable markdown reports

## 🔧 Setup Instructions

### 1. Required GitHub Secrets

Add these secrets to your repository settings (`Settings > Secrets and variables > Actions`):

```bash
# Vercel API Configuration
VERCEL_TOKEN=vercel_xxxxxxxxxxxxxxxxxx
VERCEL_PROJECT=your-project-id-or-name
VERCEL_TEAM_ID=your-team-id

# OpenAI API Configuration  
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx

# GitHub Token is automatically provided as GITHUB_TOKEN
```

### 2. Getting Your Vercel Credentials

**Vercel Token:**
```bash
# Visit: https://vercel.com/account/tokens
# Create a new token with appropriate permissions
```

**Project ID:**
```bash
# Method 1: From Vercel Dashboard URL
https://vercel.com/your-team/your-project/settings
# your-project is the project ID

# Method 2: Via API
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  https://api.vercel.com/v9/projects | jq '.projects[] | {name, id}'
```

**Team ID:**
```bash
# Get your team information
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  https://api.vercel.com/v2/user | jq '.user.id'
```

### 3. Workflow Triggers

The workflow runs automatically on:

1. **Push Events** - Any push to `main` or `develop` branches
2. **Manual Trigger** - Via GitHub Actions tab (`workflow_dispatch`)
3. **Repository Dispatch** - External webhook with type `vercel-build-failed`

## 📋 Workflow Steps

### 1. **Environment Setup**
- Checkout repository
- Setup Node.js 20 with pnpm cache
- Install dependencies

### 2. **Fetch Vercel Logs**
- Query Vercel API for latest failed deployment
- Download detailed build logs via v2 API
- Skip if no failures found

### 3. **AI Analysis** 
- Run our enhanced TypeScript analyzer script
- Generate comprehensive failure analysis
- Extract root cause and suggested fixes

### 4. **Create Reports**
- Generate human-readable `ai_analysis.md`
- Save complete analysis to `logs/vercel-fail.json`
- Include deployment metadata and timestamps

### 5. **Auto Commit**
- Commit analysis files with descriptive messages
- Push to the same branch that triggered the workflow

### 6. **GitHub Issues** (Optional)
- Create issue if same commit fails 3+ times
- Include complete analysis and action items
- Auto-label with `bug`, `deployment`, `automated`

## 📊 Generated Files

### `ai_analysis.md` - Human-Readable Report
```markdown
# 🔍 Vercel Build Failure Analysis

**Deployment ID:** dpl_abc123xyz
**Repository:** junaidaziz/codemind
**Branch:** main

## ❌ Build Failure Summary
Module not found '@/lib/db'

## 🔍 Root Cause Analysis
Missing tsconfig path alias resolution in Vercel build

## 🛠️ Suggested Fix
Add 'baseUrl' + 'paths' config to tsconfig and redeploy
```

### `logs/vercel-fail.json` - Complete Analysis Data
```json
{
  "deployment": { "uid": "dpl_abc123xyz", ... },
  "buildLogs": "Complete build logs...",
  "analysis": {
    "summary": "Module not found '@/lib/db'",
    "cause": "Missing tsconfig path alias resolution",
    "fix": "Add 'baseUrl' + 'paths' config to tsconfig"
  },
  "failureTracking": {
    "commitSha": "abc1234567890",
    "failureCount": 1
  }
}
```

## 🔄 Integration with Vercel

### Option 1: Webhook Integration (Recommended)

Set up a Vercel webhook to trigger the workflow on deployment failures:

1. **Vercel Dashboard** → Project Settings → Git → Webhooks
2. **URL:** `https://api.github.com/repos/junaidaziz/codemind/dispatches`
3. **Events:** `deployment.failed`
4. **Headers:**
   ```
   Authorization: token YOUR_GITHUB_PAT
   Accept: application/vnd.github.v3+json
   ```
5. **Payload:**
   ```json
   {
     "event_type": "vercel-build-failed",
     "client_payload": {
       "deployment_id": "{{ DEPLOYMENT_ID }}",
       "project_id": "{{ PROJECT_ID }}"
     }
   }
   ```

### Option 2: Scheduled Analysis

Add a scheduled trigger to check for failures periodically:

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
```

## 🛠 Customization

### Modify Analysis Frequency
```yaml
# Only analyze failures from last 24 hours
- name: Fetch recent failures
  run: |
    SINCE_DATE=$(date -d '1 day ago' -u '+%Y-%m-%dT%H:%M:%SZ')
    curl "...&since=$SINCE_DATE"
```

### Custom Issue Templates
```yaml
# Add custom labels and assignees
labels: ['bug', 'deployment', 'urgent', 'ai-analysis']
assignees: ['junaidaziz', 'dev-team']
```

### Notification Integration
```yaml
# Add Slack notification step
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: "🚨 Build failure analysis completed"
```

## 🔍 Troubleshooting

### Common Issues

**"No failed deployments found"**
- ✅ Check `VERCEL_PROJECT` and `VERCEL_TEAM_ID` secrets
- ✅ Verify Vercel token has project access
- ✅ Ensure deployments exist and have failed

**"Analysis script failed"**
- ✅ Verify `OPENAI_API_KEY` is valid
- ✅ Check OpenAI account credits
- ✅ Review script logs in Actions tab

**"GitHub issue creation failed"**
- ✅ Ensure `GITHUB_TOKEN` has issues write permission
- ✅ Check repository settings allow issue creation

### Debug Mode

Enable detailed logging:

```yaml
- name: Debug Vercel API
  run: |
    echo "Debug: Testing Vercel API access..."
    curl -v -H "Authorization: Bearer ${{ secrets.VERCEL_TOKEN }}" \
      "https://api.vercel.com/v2/user"
```

## 📈 Benefits

1. **Faster Resolution** - Immediate AI analysis of build failures
2. **Documentation** - Automatic tracking of failure patterns
3. **Team Collaboration** - Shared analysis reports in repository
4. **Issue Management** - Automated GitHub issue creation
5. **Historical Data** - Complete logs for trend analysis

## 🔐 Security

- All API tokens stored as GitHub secrets
- No sensitive data exposed in logs
- Analysis files committed to repository (review before merging)
- Webhook signatures validated (if using external triggers)

---

**Ready to automate your Vercel build failure analysis!** 🚀

The workflow will automatically run on your next push or deployment failure, providing instant AI-powered insights to keep your deployments healthy.