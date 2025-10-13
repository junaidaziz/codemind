# 🔑 Auto Fix System - API Keys & Environment Setup Guide

## Required API Keys & Configuration

To make your Auto Fix & Pull Request System fully operational, you need to obtain and configure the following keys:

## 1. 🤖 **OpenAI API Key** (CRITICAL)
**Required for**: AI-powered error analysis and fix generation

### How to get it:
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account (or create one)
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

### Add to your .env file:
```env
OPENAI_API_KEY="sk-your-actual-openai-api-key-here"
```

**Cost estimate**: ~$0.10-$1.00 per auto-fix session (depending on code complexity)

---

## 2. 🐙 **GitHub Integration** (CRITICAL)
**Required for**: Creating branches, commits, and pull requests

### Option A: GitHub App (Recommended for production)

#### Steps to create GitHub App:
1. Go to [GitHub Developer Settings](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Fill in details:
   - **App name**: "CodeMind Auto Fix"
   - **Homepage URL**: Your app URL
   - **Webhook URL**: `https://your-domain.com/api/github/webhook`
4. Set permissions:
   - **Contents**: Read & Write
   - **Pull requests**: Read & Write
   - **Issues**: Read & Write
   - **Metadata**: Read
5. Generate private key and download it
6. Install the app on your repositories

#### Add to .env:
```env
GITHUB_APP_ID="123456"
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
your-private-key-content-here
-----END RSA PRIVATE KEY-----"
GITHUB_INSTALLATION_ID="12345678"
GITHUB_WEBHOOK_SECRET="your-webhook-secret"
```

### Option B: Personal Access Token (Easier for development)

#### Steps to create PAT:
1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes:
   - ✅ **repo** (Full control of private repositories)
   - ✅ **workflow** (Update GitHub Action workflows)
   - ✅ **write:packages** (Upload packages to GitHub Package Registry)

#### Add to .env:
```env
GITHUB_TOKEN="ghp_your-personal-access-token-here"
```

---

## 3. 🗄️ **Database Configuration**
**Required for**: Storing auto-fix sessions and results

### If using Supabase (Current setup):
```env
DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres?sslmode=require"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

### If using local PostgreSQL:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/codemind"
```

---

## 4. 🌐 **Application Configuration**
```env
NODE_ENV="development"  # or "production"
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Your app URL
```

---

## 🚀 Quick Start Setup

### Step 1: Create .env.local file
```bash
cd /Users/junaidaziz/projects/personal/junaid/codemind
cp env.production.template .env.local
```

### Step 2: Fill in the critical keys
**Minimum required for auto-fix to work:**
```env
# CRITICAL - Get from OpenAI
OPENAI_API_KEY="sk-your-key-here"

# CRITICAL - Get from GitHub (choose one method)
GITHUB_TOKEN="ghp_your-token-here"
# OR
GITHUB_APP_ID="123456"
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."

# Required for database
DATABASE_URL="your-database-connection-string"
```

### Step 3: Apply database schema
```bash
npx prisma db push
```

### Step 4: Test the system
```bash
npm run dev
# Visit: http://localhost:3000/auto-fix
# Click "Test Auto Fix" button
```

---

## 🔧 Configuration Priority

### **MUST HAVE** (System won't work without these):
1. ✅ **OPENAI_API_KEY** - For AI-powered error analysis
2. ✅ **GITHUB_TOKEN** or **GitHub App credentials** - For PR creation
3. ✅ **DATABASE_URL** - For storing session data

### **SHOULD HAVE** (For full functionality):
4. 📊 **SUPABASE_*** - If using Supabase as database
5. 🔗 **NEXT_PUBLIC_APP_URL** - For proper webhooks

### **NICE TO HAVE** (For enhanced features):
6. 📈 **SENTRY_DSN** - Error monitoring
7. 🎯 **GITHUB_WEBHOOK_SECRET** - Secure webhooks
8. ⚡ **VERCEL_URL** - Auto-deployment

---

## 🧪 Testing Your Setup

### 1. Environment Validation
```bash
npm run dev
```
Check console for environment validation messages.

### 2. Auto-Fix Dashboard Test
1. Visit `http://localhost:3000/auto-fix`
2. Click "Test Auto Fix" button
3. Check if you get a session ID response

### 3. GitHub Integration Test
```bash
curl -X GET http://localhost:3000/api/github/auto-fix
```
Should return `{"authenticated": true}` if GitHub is configured correctly.

### 4. Database Test
Check if auto-fix sessions are being created:
```bash
npx prisma studio
```
Look for records in `AutoFixSession` table.

---

## 💰 Cost Estimates

### OpenAI API Usage:
- **GPT-4**: ~$0.03 per 1K tokens
- **Typical auto-fix session**: 2K-10K tokens
- **Cost per fix**: $0.06 - $0.30
- **Monthly (50 fixes)**: $3 - $15

### GitHub:
- **Free** for public repositories
- **Free** for private repositories (with limits)

### Database:
- **Supabase**: Free tier available (500MB)
- **PostgreSQL**: Self-hosted (free)

---

## 🛟 Troubleshooting

### "OpenAI API key not found"
- Ensure `OPENAI_API_KEY` starts with `sk-`
- Check you have credits in your OpenAI account

### "GitHub authentication failed"
- Verify `GITHUB_TOKEN` has repo permissions
- Or ensure GitHub App is installed on your repositories

### "Database connection failed"
- Check `DATABASE_URL` format
- Ensure database is accessible

### "Auto-fix not creating PRs"
- Verify GitHub permissions (write access to repo)
- Check repository exists and is accessible
- Ensure branch creation permissions

---

## 🎯 Next Steps After Setup

1. **Test with real errors**: Push code with intentional bugs
2. **Configure webhooks**: Set up automatic triggering on CI failures  
3. **Customize settings**: Adjust branch prefixes and PR templates
4. **Monitor usage**: Watch OpenAI usage and GitHub API limits
5. **Scale up**: Move to production environment with proper security

**Ready to revolutionize your development workflow!** 🚀