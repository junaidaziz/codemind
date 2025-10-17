# 📢 Slack/Discord Webhook Setup Guide

Complete guide for setting up deployment notifications in CodeMind.

## 🚀 Quick Setup (5 minutes)

### Option 1: Slack Webhook

1. **Create Slack Incoming Webhook:**
   - Go to https://api.slack.com/apps
   - Click **"Create New App"** → **"From scratch"**
   - Name: `CodeMind Notifications`
   - Select your workspace
   - Click **"Incoming Webhooks"** → Enable it
   - Click **"Add New Webhook to Workspace"**
   - Select channel (e.g., `#deployments` or `#dev-notifications`)
   - Copy the webhook URL (looks like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`)

2. **Add to Environment:**
   ```bash
   # Add to .env file
   echo "SLACK_WEBHOOK_URL=your_webhook_url_here" >> .env
   ```

3. **Test the webhook:**
   ```bash
   npm run notifications:test
   ```

### Option 2: Discord Webhook

1. **Create Discord Webhook:**
   - Open your Discord server
   - Go to **Server Settings** → **Integrations** → **Webhooks**
   - Click **"New Webhook"** or **"Create Webhook"**
   - Name: `CodeMind Notifications`
   - Select channel (e.g., `#deployments` or `#dev-logs`)
   - Click **"Copy Webhook URL"**
   - The URL looks like: `https://discord.com/api/webhooks/123456789/XXXXXXXXXXXXXXXXXXXX`

2. **Add to Environment:**
   ```bash
   # Add to .env file
   echo "DISCORD_WEBHOOK_URL=your_webhook_url_here" >> .env
   ```

3. **Test the webhook:**
   ```bash
   npm run notifications:test
   ```

---

## 🔧 Available NPM Scripts

```bash
# Test existing webhook configuration
npm run notifications:test

# Setup new webhook (interactive)
npm run notifications:setup

# Generate GitHub Actions workflow template
npm run notifications:setup -- --generate-template
```

---

## 📋 What You'll Get

Once configured, you'll receive notifications for:

✅ **Deployment Success** - When your app deploys successfully  
❌ **Deployment Failures** - When builds fail with error details  
🔧 **Auto-Fix Triggered** - When AI attempts to fix issues  
✅ **Auto-Fix Success** - When AI successfully resolves problems  
⚠️ **Health Alerts** - When consecutive deployment failures detected  

---

## 🎨 Notification Examples

### Slack Message Example
```
🚀 Deployment Successful
Project: CodeMind
Environment: Production
Commit: feat: Add task management (abc123)
URL: https://codemind-delta.vercel.app
Duration: 45s
```

### Discord Embed Example
```
✅ BUILD PASSED
codemind-delta.vercel.app
Deployed in 45s
View deployment →
```

---

## 🔐 Security Best Practices

1. **Never commit webhook URLs** to git
   - Add `.env` to `.gitignore` (already done)
   - Use GitHub Secrets for CI/CD

2. **Use different webhooks for different environments:**
   ```bash
   SLACK_WEBHOOK_URL_PROD=https://hooks.slack.com/services/PROD_WEBHOOK
   SLACK_WEBHOOK_URL_STAGING=https://hooks.slack.com/services/STAGING_WEBHOOK
   ```

3. **Rotate webhooks if exposed:**
   - Slack: Delete and create new webhook
   - Discord: Regenerate webhook URL

---

## 🧪 Testing Your Webhook

### Method 1: Use the test script
```bash
npm run notifications:test
```

### Method 2: Manual test with curl

**Slack:**
```bash
curl -X POST YOUR_SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test notification from CodeMind!"}'
```

**Discord:**
```bash
curl -X POST YOUR_DISCORD_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"content":"Test notification from CodeMind!"}'
```

---

## 🔗 GitHub Actions Integration

### Add Webhook to GitHub Secrets

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add one of:
   - Name: `SLACK_WEBHOOK_URL`, Value: `your_slack_webhook_url`
   - Name: `DISCORD_WEBHOOK_URL`, Value: `your_discord_webhook_url`

### Example Workflow Usage

The webhook is automatically used in:
- `.github/workflows/ci-cd.yml` - Deployment pipeline
- `.github/workflows/health-monitor.yml` - Health monitoring
- `scripts/monitor-deployment-health.js` - Deployment health checks

---

## 📊 Notification Format

### Deployment Success
```json
{
  "status": "success",
  "project": "CodeMind",
  "environment": "production",
  "commit": "feat: Add new feature (abc123)",
  "url": "https://codemind-delta.vercel.app",
  "duration": "45s"
}
```

### Deployment Failure
```json
{
  "status": "failure",
  "project": "CodeMind",
  "environment": "production",
  "commit": "fix: Update dependencies (def456)",
  "error": "Build failed: Module not found",
  "logs_url": "https://vercel.com/deployments/...",
  "auto_fix_triggered": true
}
```

### Health Alert
```json
{
  "status": "alert",
  "project": "CodeMind",
  "message": "3 consecutive deployment failures detected",
  "last_failure": "2025-10-17T10:30:00Z",
  "actions_needed": "Manual investigation required"
}
```

---

## 🐛 Troubleshooting

### Webhook not receiving messages

1. **Check webhook URL is correct:**
   ```bash
   cat .env | grep WEBHOOK
   ```

2. **Test webhook directly:**
   ```bash
   npm run notifications:test
   ```

3. **Check webhook status:**
   - Slack: Go to App Settings → Incoming Webhooks
   - Discord: Go to Server Settings → Integrations → Webhooks

### Webhook URL expired/invalid

**Slack:**
- Go to https://api.slack.com/apps
- Select your app
- Go to "Incoming Webhooks"
- Delete old webhook and create new one

**Discord:**
- Go to Server Settings → Integrations → Webhooks
- Click on your webhook
- Click "Copy Webhook URL" (or delete and recreate)

### Messages not formatted correctly

The notification format follows platform standards:
- **Slack**: Uses Block Kit and attachments
- **Discord**: Uses embeds with color coding

If formatting is broken, ensure you're using the latest version of the notification script.

---

## 🎯 Next Steps

After setting up webhooks:

1. ✅ Test the webhook works
2. ✅ Add webhook URL to GitHub Secrets
3. ✅ Enable health monitoring workflow
4. ✅ Deploy and verify notifications arrive
5. ✅ Customize notification channels/formatting as needed

---

## 📚 Related Documentation

- [Monitoring Setup Guide](./MONITORING_SETUP.md)
- [CI/CD Setup Guide](./CI_CD_SETUP.md)
- [Quick Start Guide](../QUICK_START_GUIDE.md)
- [Vercel Integration Guide](./VERCEL_INTEGRATION.md)

---

## 💡 Tips

- **Use dedicated channels** for deployment notifications (e.g., `#deployments`, `#ci-cd`)
- **Set up different webhooks** for staging and production
- **Test webhooks regularly** to ensure they're still working
- **Monitor notification volume** - too many notifications can be noise
- **Customize message format** in the notification scripts as needed

---

## ✅ Verification Checklist

- [ ] Webhook URL obtained from Slack or Discord
- [ ] Webhook URL added to `.env` file
- [ ] Webhook tested with `npm run notifications:test`
- [ ] Webhook added to GitHub repository secrets
- [ ] Received test notification successfully
- [ ] Deployment triggered and notification received
- [ ] Health monitoring workflow enabled

---

**Questions?** Check the [troubleshooting section](#-troubleshooting) or refer to platform documentation:
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Discord Webhooks](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)

---

*Last updated: October 17, 2025*
