# 🔧 Manual Setup Steps - Final Configuration

**Estimated Time:** 15 minutes  
**Prerequisites:** Access to GitHub repository settings, Vercel dashboard, and Slack/Discord

---

## ✅ Checklist Overview

- [ ] **Step 1:** Get Slack or Discord webhook URL (5 min)
- [ ] **Step 2:** Add webhook to GitHub Secrets (2 min)
- [ ] **Step 3:** Add webhook to Vercel Environment (3 min)
- [ ] **Step 4:** Test notification system locally (2 min)
- [ ] **Step 5:** Enable health monitoring workflow (3 min)

---

## 📋 Step 1: Get Webhook URL (Choose One Platform)

### Option A: Slack Webhook

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. App Name: `CodeMind Notifications`
4. Select your workspace → Click **"Create App"**
5. In the left sidebar, click **"Incoming Webhooks"**
6. Toggle **"Activate Incoming Webhooks"** to ON
7. Click **"Add New Webhook to Workspace"**
8. Choose channel (recommend: `#deployments` or `#dev`)
9. Click **"Allow"**
10. **Copy the webhook URL** - looks like:
    ```
    https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
    ```

### Option B: Discord Webhook

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **"New Webhook"** (or **"Create Webhook"**)
4. Name: `CodeMind Notifications`
5. Select channel (recommend: `#deployments` or `#dev-logs`)
6. Click **"Copy Webhook URL"** - looks like:
    ```
    https://discord.com/api/webhooks/123456789/XXXXXXXXXXXXXXXXXXXX
    ```

---

## 📋 Step 2: Add to GitHub Secrets

1. **Go to your repository on GitHub:**
   - https://github.com/junaidaziz/codemind

2. **Navigate to Settings:**
   - Click **"Settings"** tab
   - In left sidebar: **"Secrets and variables"** → **"Actions"**

3. **Add webhook secret:**
   - Click **"New repository secret"**
   - **Name:** `SLACK_WEBHOOK_URL` (or `DISCORD_WEBHOOK_URL`)
   - **Value:** Paste your webhook URL from Step 1
   - Click **"Add secret"**

4. **Verify it's added:**
   - You should see `SLACK_WEBHOOK_URL` or `DISCORD_WEBHOOK_URL` in the list
   - The value will be hidden (shows as `***`)

---

## 📋 Step 3: Add to Vercel Environment Variables

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your project: **codemind**

2. **Navigate to Settings:**
   - Click **"Settings"** tab
   - In left sidebar: **"Environment Variables"**

3. **Add webhook variable:**
   - **Key:** `SLACK_WEBHOOK_URL` (or `DISCORD_WEBHOOK_URL`)
   - **Value:** Paste your webhook URL from Step 1
   - **Environment:** Select all (Production, Preview, Development)
   - Click **"Save"**

4. **Redeploy to apply changes:**
   - Go back to **"Deployments"** tab
   - Find latest deployment
   - Click **"..."** → **"Redeploy"**
   - Wait for deployment to complete (~1 minute)

---

## 📋 Step 4: Test Notification System

### Test 1: Local Test (Quick Check)

1. **Add webhook to your local .env file:**
   ```bash
   # In your project directory
   echo "SLACK_WEBHOOK_URL=your_webhook_url_here" >> .env
   # OR
   echo "DISCORD_WEBHOOK_URL=your_webhook_url_here" >> .env
   ```

2. **Run the test command:**
   ```bash
   npm run notifications:test
   ```

3. **Expected output:**
   ```
   ✅ Test notification sent successfully!
   Check your Slack/Discord channel.
   ```

4. **Verify in Slack/Discord:**
   - You should see a test message appear
   - Message: "🧪 Test notification from CodeMind setup"

### Test 2: GitHub Actions Test (Full Integration)

1. **Create a test workflow file:**
   ```bash
   mkdir -p .github/workflows
   cat > .github/workflows/test-notifications.yml << 'EOF'
   name: Test Notifications
   
   on:
     workflow_dispatch:
   
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - name: Send test notification
           run: |
             curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
               -H 'Content-Type: application/json' \
               -d '{"text":"✅ GitHub Actions notification test successful!"}'
   EOF
   ```

2. **Commit and push:**
   ```bash
   git add .github/workflows/test-notifications.yml
   git commit -m "test: Add notification test workflow"
   git push origin main
   ```

3. **Run the workflow:**
   - Go to GitHub → **Actions** tab
   - Select **"Test Notifications"** workflow
   - Click **"Run workflow"** → **"Run workflow"**
   - Wait ~30 seconds

4. **Verify notification received:**
   - Check your Slack/Discord channel
   - Should see: "✅ GitHub Actions notification test successful!"

---

## 📋 Step 5: Enable Health Monitoring Workflow

The health monitoring workflow is already created but needs to be enabled.

1. **Verify workflow exists:**
   ```bash
   ls -la .github/workflows/health-monitor.yml
   ```
   - Should show the file exists

2. **Check workflow status on GitHub:**
   - Go to GitHub → **Actions** tab
   - Look for **"Deployment Health Monitor"** in workflows list

3. **Workflow runs automatically:**
   - Schedule: Every hour (cron: `0 * * * *`)
   - Checks deployment health
   - Sends alerts for consecutive failures

4. **Manual trigger (optional):**
   - Go to **Actions** tab
   - Select **"Deployment Health Monitor"**
   - Click **"Run workflow"** → **"Run workflow"**
   - This will run immediately to test

5. **Verify it works:**
   - Check workflow run completes successfully
   - Review logs to see health check results
   - Notification sent only if issues detected

---

## 🎯 Verification Checklist

After completing all steps, verify:

- [ ] Webhook URL obtained from Slack or Discord
- [ ] Webhook added to GitHub Secrets
- [ ] Webhook added to Vercel Environment Variables
- [ ] Vercel redeployed with new environment variable
- [ ] Local test passed (`npm run notifications:test`)
- [ ] GitHub Actions test workflow ran successfully
- [ ] Notification received in Slack/Discord
- [ ] Health monitoring workflow visible in Actions tab
- [ ] Health monitoring can be triggered manually

---

## 🐛 Troubleshooting

### "Webhook URL not working"
- **Check URL format:** Must start with `https://`
- **Slack:** Should be `hooks.slack.com/services/...`
- **Discord:** Should be `discord.com/api/webhooks/...`
- **Try regenerating:** Delete and create new webhook

### "No notification received"
- **Wait 30 seconds:** Sometimes delayed
- **Check channel:** Verify you're watching the right channel
- **Test webhook directly:**
  ```bash
  curl -X POST YOUR_WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d '{"text":"Direct test"}'
  ```

### "GitHub Action failed"
- **Check secret name:** Must exactly match `SLACK_WEBHOOK_URL` or `DISCORD_WEBHOOK_URL`
- **Check secret value:** No extra spaces or quotes
- **Re-add secret:** Delete and add again

### "Vercel environment variable not working"
- **Redeploy required:** Changes take effect only after redeploy
- **Check environment:** Should be added to all environments
- **Check spelling:** Variable name must match exactly

---

## 📝 After Setup

Once all steps complete:

1. **Update copilot-tasks.md:**
   - Mark all steps as complete
   - Add timestamp

2. **Test end-to-end:**
   - Push a change that triggers deployment
   - Verify notification arrives
   - Check notification includes correct info

3. **Monitor for 24 hours:**
   - Watch for health check notifications
   - Verify no false alerts

4. **Optional enhancements:**
   - Set up separate webhooks for staging/production
   - Customize notification messages
   - Add more notification channels

---

## 🎉 Success Criteria

✅ You're done when:
- Test notifications arrive in Slack/Discord
- GitHub Actions can send notifications
- Health monitoring workflow is active
- All environment variables are set
- System ready for production monitoring

---

## 📚 Related Guides

- [Slack/Discord Setup Guide](./docs/SLACK_DISCORD_SETUP.md) - Detailed webhook documentation
- [Quick Start Guide](./QUICK_START_GUIDE.md) - Overall setup guide
- [Monitoring Setup](./docs/MONITORING_SETUP.md) - Health monitoring details

---

**Questions or issues?** See troubleshooting section above or check the related guides.

**Next:** After completing these steps, your deployment monitoring is fully configured! 🚀
