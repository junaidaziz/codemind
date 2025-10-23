# 🚀 Quick Start Guide - Complete Your Setup in 20 Minutes

**Status:** All code is ready! Just need your configuration values.

**Time to Complete:** ~20 minutes total

---

## 📋 What You'll Do

1. ✅ **Create a Pull Request** (2 min) - Verify CI/CD works
2. ✅ **Configure Slack Notifications** (5 min) - Get deployment alerts
3. ✅ **Set Up Vercel Webhook** (8 min) - Enable auto-fix on failures
4. ✅ **Enable Health Monitoring** (5 min) - Track deployment health

---

## 1️⃣ Create Pull Request for CI/CD Verification (2 min)

### What This Tests
- Code quality checks (ESLint, TypeScript)
- Unit tests on Node 18 & 20
- E2E tests with Playwright
- Docker build & security scanning
- Codecov integration

### Steps

**Click this link:**
👉 https://github.com/junaidaziz/codemind/compare/main...test/ci-cd-verification

**Or use GitHub CLI:**
```bash
gh pr create --base main --head test/ci-cd-verification \
  --title "test: CI/CD Pipeline Verification" \
  --body "Verifying complete CI/CD pipeline execution"
```

### What to Watch For
1. Go to: https://github.com/junaidaziz/codemind/actions
2. Watch all jobs execute (should see ✅ for each)
3. Check Codecov report uploads
4. **Don't merge** - this is just for testing

### Expected Result
All GitHub Actions jobs pass ✅

---

## 2️⃣ Configure Slack Notifications (5 min)

### Why This Matters
Get instant alerts when:
- Deployments fail
- Health checks detect issues
- Auto-fix creates PRs

### Steps

#### A. Get Slack Webhook URL (3 min)

1. Go to: https://api.slack.com/messaging/webhooks
2. Click "Create your Slack app"
3. Choose "From scratch"
4. Name it: "CodeMind Deployments"
5. Choose your workspace
6. Go to "Incoming Webhooks" → Enable
7. Click "Add New Webhook to Workspace"
8. Select channel (e.g., #deployments or #alerts)
9. Copy the webhook URL (looks like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`)

#### B. Configure Locally (1 min)

```bash
# Run the setup script
npm run notifications:setup -- --platform slack --webhook-url "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

#### C. Test It (1 min)

```bash
# Send a test message
npm run notifications:test
```

You should see a message in your Slack channel! 🎉

#### D. Add to Environment Files

```bash
# Add to your local .env
echo 'SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"' >> .env

# Add to Vercel production
vercel env add SLACK_WEBHOOK_URL production
# Paste your webhook URL when prompted

# Add to Vercel preview
vercel env add SLACK_WEBHOOK_URL preview
# Paste your webhook URL when prompted
```

### Expected Result
Test message appears in Slack ✅

---

## 3️⃣ Set Up Vercel Webhook (8 min)

### Why This Matters
Automatically triggers auto-fix when deployments fail.

### Steps

#### A. Get Your Vercel Domain (2 min)

**Option 1: From Vercel Dashboard**
1. Go to: https://vercel.com/dashboard
2. Click your project
3. Copy the domain (e.g., `codemind-abc123.vercel.app`)

**Option 2: From CLI**
```bash
vercel ls --prod
# Copy the URL from the output
```

**Option 3: From Recent Deployment**
```bash
npm run fetch-vercel-logs -- --limit 1
# Look for "url" field in output
```

#### B. Add Production URL to Environment (1 min)

```bash
# Add to local .env
echo 'PRODUCTION_URL="https://YOUR-DOMAIN.vercel.app"' >> .env

# Add to Vercel
vercel env add PRODUCTION_URL production
# Paste: https://YOUR-DOMAIN.vercel.app

vercel env add PRODUCTION_URL preview
# Paste: https://YOUR-DOMAIN.vercel.app
```

#### C. Configure Webhook Secret (2 min)

```bash
# Add webhook secret to Vercel (already in your .env)
# Secret: 3KkLB/5/IlI/2akH6Unrlh1QtfG9zp53Dcf7vXjDnSY=

vercel env add VERCEL_WEBHOOK_SECRET production
# Paste: 3KkLB/5/IlI/2akH6Unrlh1QtfG9zp53Dcf7vXjDnSY=

vercel env add VERCEL_WEBHOOK_SECRET preview
# Paste: 3KkLB/5/IlI/2akH6Unrlh1QtfG9zp53Dcf7vXjDnSY=
```

#### D. Deploy Webhook Handler (1 min)

```bash
# Push current code to trigger deployment
git push origin main

# Or deploy manually
vercel --prod
```

Wait for deployment to complete (~2 min).

#### E. Create Webhook in Vercel (2 min)

```bash
# Replace YOUR-DOMAIN with your actual domain
node scripts/configure-vercel-webhook.js --url https://YOUR-DOMAIN.vercel.app/api/webhooks/vercel-deployment
```

The script will:
- ✅ Create webhook in Vercel
- ✅ Configure for all deployment events
- ✅ Set up signature verification
- ✅ Test the endpoint

#### F. Verify Webhook Created

```bash
npm run vercel-webhook:list
```

You should see your webhook listed! ✅

### Expected Result
Webhook active in Vercel, ready to trigger auto-fix ✅

---

## 4️⃣ Enable Health Monitoring (5 min)

### Why This Matters
- Automated hourly deployment checks
- Alerts on repeated failures
- Production endpoint monitoring

### Steps

#### A. Add Secrets to GitHub Actions (3 min)

1. Go to: https://github.com/junaidaziz/codemind/settings/secrets/actions
2. Click "New repository secret"
3. Add these secrets:

**Secret 1: SLACK_WEBHOOK_URL**
- Name: `SLACK_WEBHOOK_URL`
- Value: Your Slack webhook URL from Step 2

**Secret 2: PRODUCTION_URL**
- Name: `PRODUCTION_URL`
- Value: `https://YOUR-DOMAIN.vercel.app`

**Secret 3: VERCEL_TOKEN** (if not already added)
- Name: `VERCEL_TOKEN`
- Value: Your Vercel API token
- Get it from: https://vercel.com/account/tokens

**Secret 4: VERCEL_PROJECT_ID** (if not already added)
- Name: `VERCEL_PROJECT_ID`
- Value: Find it in your Vercel project settings

**Secret 5: VERCEL_TEAM_ID** (if using team)
- Name: `VERCEL_TEAM_ID`
- Value: Find it in Vercel team settings

#### B. Enable Workflow (1 min)

The workflow runs automatically every hour. To verify it's enabled:

1. Go to: https://github.com/junaidaziz/codemind/actions/workflows/health-monitor.yml
2. Click "Enable workflow" if disabled
3. Optionally click "Run workflow" to test immediately

#### C. Test Health Check Locally (1 min)

```bash
# Run a quick health check
npm run health:check

# Run full 24-hour analysis
npm run health:monitor
```

### Expected Result
Health monitoring active, alerts configured ✅

---

## 🎯 Verification Checklist

Run these commands to verify everything is working:

```bash
# 1. Check health monitoring
npm run health:check
# Should show: ✅ All systems healthy!

# 2. Test notifications
npm run notifications:test
# Should send message to Slack

# 3. List Vercel webhooks
npm run vercel-webhook:list
# Should show 1 webhook

# 4. Fetch recent deployment logs
npm run fetch-vercel-logs -- --limit 3
# Should show recent deployments

# 5. Check environment variables
vercel env ls
# Should show PRODUCTION_URL, SLACK_WEBHOOK_URL, VERCEL_WEBHOOK_SECRET
```

---

## 📊 Success Criteria

- [ ] ✅ CI/CD PR created and all jobs passing
- [ ] ✅ Slack test message received
- [ ] ✅ Webhook created in Vercel
- [ ] ✅ Health monitoring enabled on GitHub
- [ ] ✅ All verification commands pass
- [ ] ✅ Environment variables configured in Vercel

---

## 🆘 Troubleshooting

### Slack Message Not Appearing
```bash
# Check webhook URL is correct
cat .env | grep SLACK_WEBHOOK_URL

# Test with curl
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test from terminal"}'
```

### Webhook Not Creating
```bash
# Check Vercel credentials
vercel whoami

# Check environment variables
cat .env | grep VERCEL

# Try listing projects
vercel ls
```

### Health Check Failing
```bash
# Check Vercel token
echo $VERCEL_TOKEN

# Check deployment exists
npm run fetch-vercel-logs -- --limit 1

# Check production URL
curl https://YOUR-DOMAIN.vercel.app/api/health
```

---

## 📚 Next Steps After Setup

Once everything is configured:

1. **Test Auto-Fix Flow**
   ```bash
   # Create a test deployment that fails
   git checkout -b test/auto-fix
   # Make a small syntax error
   git commit -am "test: trigger auto-fix"
   git push origin test/auto-fix
   
   # Watch webhook trigger auto-fix
   # Should see GitHub issue + PR created automatically
   ```

2. **Monitor Deployments**
   ```bash
   # Check recent deployment health
   npm run health:monitor
   
   # Fetch failed deployment logs
   npm run fetch-vercel-logs:errors
   ```

3. **Review Documentation**
   - `docs/MONITORING_SETUP.md` - Detailed monitoring guide
   - `docs/VERCEL_INTEGRATION.md` - Vercel integration details
   - `docs/CI_CD_SETUP.md` - CI/CD architecture
   - `VERIFICATION_SUMMARY.md` - Test results
   - `FINAL_STATUS.md` - Complete project status

4. **Optional: Configure Discord** (Alternative to Slack)
   ```bash
   # Get Discord webhook from server settings → Integrations
   npm run notifications:setup -- --platform discord --webhook-url "YOUR_DISCORD_WEBHOOK"
   npm run notifications:test
   ```

---

## 🎉 You're Done!

After completing these steps:
- ✅ CI/CD pipeline verified and working
- ✅ Real-time deployment notifications active
- ✅ Auto-fix triggers on failures
- ✅ Health monitoring running hourly
- ✅ Production deployment secured

**Your project is now 100% complete!** 🚀

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Test notifications | `npm run notifications:test` |
| Check health | `npm run health:check` |
| Monitor 24h | `npm run health:monitor` |
| List webhooks | `npm run vercel-webhook:list` |
| Fetch logs | `npm run fetch-vercel-logs` |
| Setup notifications | `npm run notifications:setup` |

---

**Time Investment:** 20 minutes  
**Benefit:** Automated deployment monitoring + auto-fix system  
**Status:** Production Ready 🟢

Let's get started! 🚀
