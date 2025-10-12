# Auto-Analyze Failed Vercel Builds - Enhanced

A comprehensive TypeScript script that automatically analyzes failed Vercel deployments using AI-powered root cause analysis with GitHub issue automation.

## 🎯 Enhanced Features

- ✅ **Fetches latest failed Vercel deployment** via Vercel API v2
- ✅ **Retrieves detailed build logs** with enhanced event tracking
- ✅ **Stores logs in `/logs/` directory** for organized debugging
- ✅ **AI-powered analysis** using OpenAI **gpt-4o-mini** for cost-effective analysis
- ✅ **Enhanced console output** with emoji-formatted summaries
- ✅ **Failure tracking** to detect repeated issues
- ✅ **GitHub Issues automation** for repeated failures (3+ similar issues)
## 🎯 Features

- ✅ **Fetches latest failed Vercel deployment** via Vercel API v2
- ✅ **Retrieves detailed build logs** with timestamps and events
- ✅ **Stores logs in `/logs/` directory** for organized debugging
- ✅ **AI-powered analysis** using OpenAI GPT-4o-mini for cost-effective analysis
- ✅ **Enhanced output format** with emojis and structured summaries
- ✅ **GitHub Issues automation** for repeated failures (optional)
- ✅ **Failure tracking** with commit SHA monitoring
- ✅ **100% TypeScript** with strict typing (no `any` types)
- ✅ **Comprehensive error handling** and validation
- ✅ **Comprehensive error handling** and validation

## 🚀 Quick Start

### 1. Environment Setup

Create or update your `.env.local` file with the required API keys:

```bash
# Vercel API Configuration
VERCEL_TOKEN=vercel_xxxxxxxxxxxxxxxxxx
VERCEL_PROJECT=codemind
VERCEL_TEAM=junaidaziz

# OpenAI API Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx

# GitHub Integration (Optional - for automated issue creation)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxx
GITHUB_OWNER=junaidaziz
GITHUB_REPO=codemind
```

### 2. Get Your API Tokens

**Vercel Token:**
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Create a new token with appropriate permissions
3. Copy the token (starts with `vercel_`)

**OpenAI API Key:**
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-proj-`)

### 3. Run the Analysis

```bash
# Using npm script
npm run analyze-vercel

# Or directly with ts-node
npx ts-node scripts/analyze-vercel-build.ts
```

## 📋 Example Output

```bash
🚀 Starting Vercel Build Analysis...

🔍 Fetching latest deployments...
❌ Found failed deployment: dpl_abc123xyz (2025-10-12T10:30:45.000Z)
📄 Fetching build logs from v2 API...
📄 Retrieved 2,847 characters of build logs
💾 Saving build logs to logs/vercel-fail.json...
🤖 Analyzing build logs with GPT-4o-mini...
🤖 Analysis completed successfully

❌ Build failed: Module not found '@/lib/db'
🔍 Cause: Missing tsconfig path alias resolution in Vercel build
🛠️ Fix: Add 'baseUrl' + 'paths' config to tsconfig and redeploy

� Deployment Details:
   • ID: dpl_abc123xyz
   • Project: codemind
   • Commit: abc1234
   • Failed At: 10/12/2025, 10:30:45 AM

✅ Analysis complete! Full details saved to logs/vercel-fail.json
```

## 📁 Generated Files

The script creates `logs/vercel-fail.json` with complete analysis results:

```json
{
  "deployment": {
    "uid": "dpl_abc123xyz",
    "name": "codemind",
    "state": "ERROR",
    "createdAt": 1697104245000,
    "timestamp": "2025-10-12T10:30:45.000Z",
    "inspectorUrl": "https://vercel.com/...",
    "gitSource": {
      "sha": "abc1234567890",
      "ref": "refs/heads/main"
    }
  },
  "buildLogs": "Build logs from v2 API with detailed events...",
  "analysis": {
    "summary": "Module not found '@/lib/db'",
    "cause": "Missing tsconfig path alias resolution",
    "fix": "Add 'baseUrl' + 'paths' config to tsconfig and redeploy"
  },
  "failureTracking": {
    "commitSha": "abc1234567890",
    "failureCount": 1,
    "firstFailure": "2025-10-12T10:30:45.000Z",
    "lastFailure": "2025-10-12T10:30:45.000Z"
  },
  "timestamp": "2025-10-12T10:35:20.123Z"
}
```

## 🔍 Troubleshooting

### Common Issues

**"No failed deployments found"**
- ✅ Verify your project has recent failed deployments
- ✅ Check `VERCEL_PROJECT` and `VERCEL_TEAM` environment variables

**"Vercel API error: 403 Forbidden"**
- ✅ Verify your `VERCEL_TOKEN` is correct and active
- ✅ Check token permissions for the project

**"OpenAI API error"**
- ✅ Verify your `OPENAI_API_KEY` is correct
- ✅ Check OpenAI account credits and GPT-4 access

### Debug Your Setup

Test your Vercel configuration:
```bash
# Test your Vercel token
curl -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v2/user

# List your projects
curl -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v9/projects
```

## 🛠 Technical Details

- **Language**: TypeScript with strict typing (no `any` types)
- **APIs**: Vercel API v2 for deployments and build events
- **AI Model**: OpenAI GPT-4o-mini for cost-effective analysis
- **Storage**: Organized `/logs/` directory structure
- **Output**: Enhanced console format with emojis + JSON file
- **GitHub Integration**: Automated issue creation for repeated failures
- **Error Handling**: Comprehensive validation and fallbacks

## 🔄 GitHub Automation (Optional)

When the same commit SHA fails 3 times, the script can automatically:

1. **Create a GitHub Issue** with failure analysis
2. **Tag relevant team members** 
3. **Include build logs and AI analysis**
4. **Track failure patterns** across deployments

### Setup GitHub Integration:

```bash
# Add to .env.local
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxx
GITHUB_OWNER=junaidaziz
GITHUB_REPO=codemind
```

### GitHub Token Setup:
1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Create a token with `repo` and `issues` permissions
3. Add the token to your `.env.local` file

## 📊 API Usage & Costs

### Vercel API Calls:
- **Deployments**: `GET /v2/deployments` - List failed deployments
- **Events**: `GET /v2/deployments/{id}/events` - Detailed build logs

### OpenAI API Usage:
- **Model**: `gpt-4o-mini` (cost-effective choice)
- **Average Cost**: ~$0.001-0.003 per analysis
- **Token Limit**: 1000 tokens for focused responses