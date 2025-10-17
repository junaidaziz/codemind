# 📊 Deployment Monitoring & Notifications Guide

**Status:** ✅ Scripts Created, ⏳ Configuration Pending  
**Last Updated:** January 17, 2025

---

## Overview

CodeMind now has a complete deployment monitoring and notification system with:
- **Health Monitoring** - Track deployment success/failure rates
- **Alert System** - Slack/Discord notifications for issues
- **Automated Checks** - GitHub Actions cron job monitoring
- **Manual Tools** - CLI scripts for on-demand checks

---

## 🚀 Quick Setup

### Step 1: Configure Notifications

Choose Slack or Discord (or both) for deployment notifications.

#### Option A: Slack

1. **Create Slack Webhook:**
   ```
   1. Go to: https://api.slack.com/messaging/webhooks
   2. Click "Create New App" → "From scratch"
   3. Name: "CodeMind Deployment Bot"
   4. Select your workspace
   5. Click "Incoming Webhooks" → Enable
   6. Click "Add New Webhook to Workspace"
   7. Select channel (e.g., #deployments)
   8. Copy the webhook URL
   ```

2. **Configure Webhook:**
   ```bash
   npm run notifications:setup -- --platform slack --webhook-url https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

#### Option B: Discord

1. **Create Discord Webhook:**
   ```
   1. Go to your Discord server
   2. Right-click channel → Edit Channel
   3. Click "Integrations" → "Webhooks"
   4. Click "New Webhook"
   5. Name: "CodeMind Deployment Bot"
   6. Copy webhook URL
   ```

2. **Configure Webhook:**
   ```bash
   npm run notifications:setup -- --platform discord --webhook-url https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
   ```

### Step 2: Add to Environment Variables

Add webhook URLs to your environment files:

**Local (.env):**
```bash
# Add to .env file
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
# OR
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Also add your production URL for health checks
PRODUCTION_URL="https://your-domain.vercel.app"
```

**GitHub Secrets:**
```bash
# Go to: https://github.com/junaidaziz/codemind/settings/secrets/actions
# Add these secrets:
SLACK_WEBHOOK_URL      # Your Slack webhook URL
DISCORD_WEBHOOK_URL    # Your Discord webhook URL
PRODUCTION_URL         # Your production domain
```

**Vercel Environment:**
```bash
vercel env add SLACK_WEBHOOK_URL production
vercel env add PRODUCTION_URL production
# Paste your webhook URL when prompted
```

### Step 3: Test Notifications

```bash
# Test configured webhooks
npm run notifications:test
```

**Expected Output:**
```
🧪 Testing webhook configuration...

📨 Testing Slack webhook...
✅ Slack webhook test successful!

📊 Test Results:
   ✅ Slack: success
```

### Step 4: Test Health Monitoring

```bash
# Run manual health check
npm run health:check
```

**Expected Output:**
```
🔍 CodeMind Deployment Health Monitor

📊 Checking deployments from last 1h
⚠️  Alert threshold: 3 consecutive failures

📥 Fetching deployment data...
✅ Found 5 deployments

📊 Deployment Statistics:
   Total: 5
   ✅ Ready: 5
   ❌ Failed: 0
   📈 Success Rate: 100.0%
   🔥 Consecutive Failures: 0

🏥 Checking production health endpoint...
✅ Health check passed (200) - Response time: 245ms

✅ All systems healthy!
```

---

## 📋 Available Commands

### Notification Setup
```bash
# Show usage
npm run notifications:setup

# Configure Slack
npm run notifications:setup -- --platform slack --webhook-url <url>

# Configure Discord
npm run notifications:setup -- --platform discord --webhook-url <url>

# Test configured webhooks
npm run notifications:test

# Generate GitHub Actions template
npm run notifications:setup -- --generate-template
```

### Health Monitoring
```bash
# Run health monitor (last 24h)
npm run health:monitor

# Check last 1 hour
npm run health:check

# Custom timeframe
node scripts/monitor-deployment-health.js --timeframe 7d

# Custom alert threshold
node scripts/monitor-deployment-health.js --alert-threshold 5

# Combined options
node scripts/monitor-deployment-health.js --timeframe 12h --alert-threshold 2
```

---

## 🤖 GitHub Actions Integration

### Enable Automated Monitoring

The health monitoring workflow is already created at `.github/workflows/health-monitor.yml`.

**Features:**
- ✅ Runs every hour automatically
- ✅ Checks deployment health
- ✅ Sends alerts if issues detected
- ✅ Can be triggered manually

**To Enable:**

1. **Add Required Secrets** (see Step 2 above)
2. **Push to Main Branch** (workflow is already committed)
3. **Monitor Runs:**
   ```
   https://github.com/junaidaziz/codemind/actions/workflows/health-monitor.yml
   ```

4. **Manual Trigger:**
   - Go to Actions tab
   - Select "Health Monitor" workflow
   - Click "Run workflow"

### Customize Schedule

Edit `.github/workflows/health-monitor.yml`:

```yaml
on:
  schedule:
    - cron: '0 * * * *'      # Every hour
    # - cron: '*/30 * * * *' # Every 30 minutes
    # - cron: '0 */6 * * *'  # Every 6 hours
    # - cron: '0 0 * * *'    # Daily at midnight
```

---

## 🔔 Notification Examples

### Slack Notification

When issues are detected, Slack receives:

```
🚨 Deployment Health Alert

⚠️ 3 consecutive deployment failures detected

Total Deployments: 10
Failed: 3
Success Rate: 70.0%
Consecutive Failures: 3
Production Healthy: ✅

Recent failed deployments:
1. app-abc123.vercel.app (production)
   ID: dpl_abc123
   Time: 1/17/2025, 10:30:00 AM
```

### Discord Notification

Similar format with embedded message and color coding:
- 🔴 Red for critical (≥3 failures)
- 🟡 Yellow for warnings

---

## 📊 Monitoring Metrics

The health monitor tracks:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| **Deployment Status** | Success/failure state | 3 consecutive failures |
| **Error Rate** | Percentage of failed deployments | >30% |
| **Health Endpoint** | Production API availability | HTTP status != 200 |
| **Response Time** | API response latency | >10 seconds timeout |
| **Production Target** | Production deployment health | State != READY |

---

## 🔧 Advanced Configuration

### Custom Alert Logic

Edit `scripts/monitor-deployment-health.js` to customize alert conditions:

```javascript
// Current logic
const shouldAlert = stats.consecutiveFailures >= ALERT_THRESHOLD || !healthCheck.healthy;

// Custom: Alert on high error rate
const shouldAlert = 
  stats.consecutiveFailures >= ALERT_THRESHOLD || 
  !healthCheck.healthy ||
  parseFloat(stats.errorRate) > 30;
```

### Multiple Notification Channels

Configure both Slack and Discord:

```bash
# .env file
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

Both channels will receive alerts simultaneously.

### Webhook Message Customization

Edit notification functions in scripts:

**Slack:**
```javascript
// In scripts/setup-notifications.js or monitor-deployment-health.js
const payload = {
  text: "Custom message",
  attachments: [{
    color: "danger",
    fields: [/* custom fields */]
  }]
};
```

**Discord:**
```javascript
const payload = {
  content: "Custom message",
  embeds: [{
    title: "Custom Title",
    color: 15158332,  // Red
    fields: [/* custom fields */]
  }]
};
```

---

## 🧪 Testing Checklist

- [ ] Slack webhook configured
- [ ] Discord webhook configured (optional)
- [ ] Environment variables added to .env
- [ ] Secrets added to GitHub Actions
- [ ] Environment variables added to Vercel
- [ ] Test notification sent successfully (`npm run notifications:test`)
- [ ] Health monitor runs successfully (`npm run health:check`)
- [ ] GitHub Actions workflow enabled
- [ ] First automated check completed

---

## 🐛 Troubleshooting

### Issue: "Missing required environment variables"

**Solution:**
```bash
# Verify .env file contains:
grep -E "VERCEL_TOKEN|VERCEL_PROJECT_ID|SLACK_WEBHOOK_URL" .env

# If missing, add them
echo 'VERCEL_TOKEN="your-token"' >> .env
echo 'SLACK_WEBHOOK_URL="your-webhook"' >> .env
```

### Issue: "Webhook test failed"

**Solution:**
1. Verify webhook URL is correct
2. Check webhook hasn't been deleted in Slack/Discord
3. Test with curl:
   ```bash
   curl -X POST -H 'Content-Type: application/json' \
     -d '{"text": "Test"}' \
     YOUR_WEBHOOK_URL
   ```

### Issue: "Health check failed"

**Solution:**
1. Verify PRODUCTION_URL is correct
2. Check `/api/health` endpoint exists
3. Test manually:
   ```bash
   curl https://your-domain.vercel.app/api/health
   ```

### Issue: "GitHub Actions workflow not running"

**Solution:**
1. Check workflow file syntax: `.github/workflows/health-monitor.yml`
2. Verify secrets are added to repository
3. Check Actions tab for error messages
4. Try manual trigger first

---

## 📚 Integration with CI/CD

### Add Notifications to Deployment Jobs

Edit `.github/workflows/ci-cd.yml` and add notification steps:

```yaml
- name: Notify deployment success
  if: success()
  run: |
    npm run notifications:setup -- --generate-template
    # Follow the generated template
```

Or use the generated template:
```bash
npm run notifications:setup -- --generate-template
```

---

## 📈 Monitoring Best Practices

1. **Alert Threshold:** Start with 3 consecutive failures, adjust based on your deployment frequency
2. **Check Frequency:** Hourly checks are sufficient for most projects
3. **Multiple Channels:** Use both Slack and email for critical alerts
4. **Response Time:** Set up escalation if alerts aren't acknowledged
5. **Regular Reviews:** Weekly review of deployment metrics

---

## 🔗 Related Documentation

- **Vercel Integration:** `VERCEL_INTEGRATION_STATUS.md`
- **CI/CD Setup:** `docs/CI_CD_SETUP.md`
- **Next Steps:** `NEXT_STEPS.md`
- **Webhook Setup:** `VERCEL_WEBHOOK_SETUP.md`

---

## 🎯 Quick Reference

```bash
# Setup notifications
npm run notifications:setup -- --platform slack --webhook-url <url>
npm run notifications:test

# Run health checks
npm run health:check
npm run health:monitor

# GitHub Actions
# Monitor: https://github.com/junaidaziz/codemind/actions/workflows/health-monitor.yml
```

---

**Ready to enable monitoring?** Follow the Quick Setup section above! 🚀
