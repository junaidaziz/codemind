# Auto-Analyze Failed Vercel Builds

A TypeScript script that automatically analyzes failed Vercel deployments using AI-powered root cause analysis.

## 🎯 Features

- ✅ **Fetches latest failed Vercel deployment** via Vercel API
- ✅ **Retrieves detailed build logs** with timestamps and events
- ✅ **Stores logs locally** in `vercel-fail.json` for debugging
- ✅ **AI-powered analysis** using OpenAI GPT-4 for root cause identification
- ✅ **Human-readable summaries** with actionable fix suggestions
- ✅ **100% TypeScript** with strict typing (no `any` types)
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
📄 Fetching build logs...
📄 Retrieved 2,847 characters of build logs
💾 Saving build logs to vercel-fail.json...
🤖 Analyzing build logs with OpenAI...
🤖 Analysis completed successfully

================================================================================
🔍 VERCEL BUILD FAILURE ANALYSIS
================================================================================

📅 Deployment Details:
   • ID: dpl_abc123xyz
   • Project: codemind
   • Failed At: 10/12/2025, 10:30:45 AM
   • URL: https://codemind-git-main-junaidaziz.vercel.app

🎯 Analysis Results:
   • Category: TypeScript Error
   • Confidence: 95%

❌ Root Cause:
   TypeScript compilation failed due to implicit 'any' type on parameter 'msg'

🔧 Suggested Fix:
   1. Add explicit typing to the filter parameter:
      .filter((msg: typeof session.messages[0]) => ...)
   2. Run 'npx tsc --noEmit' to verify TypeScript compliance
   3. Commit the changes and redeploy

================================================================================
✅ Analysis complete! Check vercel-fail.json for full details.
================================================================================
```

## 📁 Generated Files

The script creates `vercel-fail.json` with complete analysis results:

```json
{
  "deployment": {
    "uid": "dpl_abc123xyz",
    "name": "codemind",
    "state": "ERROR",
    "createdAt": 1697104245000,
    "timestamp": "2025-10-12T10:30:45.000Z"
  },
  "buildLogs": "=== Build abc123 ===\n[timestamp] stderr: Type error...",
  "analysis": {
    "rootCause": "TypeScript compilation failed...",
    "suggestedFix": "1. Add explicit typing...",
    "confidence": 95,
    "category": "TypeScript Error"
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
- **APIs**: Vercel API v6 for deployments, v1 for build events
- **AI Model**: OpenAI GPT-4 Turbo for analysis
- **Output**: JSON file + formatted console summary
- **Error Handling**: Comprehensive validation and fallbacks