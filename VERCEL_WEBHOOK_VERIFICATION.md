# ✅ Vercel Webhook Configuration Checklist

**Date:** October 17, 2025  
**Task:** Verify Vercel webhook configuration is complete

---

## 📋 Configuration Verification Steps

### 1️⃣ Webhook Created in Vercel Dashboard

**Check:** Go to your Vercel project dashboard
- URL: `https://vercel.com/[your-username]/codemind/settings/webhooks`
- **Verify:** You should see 1 webhook listed
- **Webhook URL should be:** `https://[your-domain].vercel.app/api/webhooks/vercel-deployment`
- **Events subscribed:** `deployment.created`, `deployment.ready`, `deployment.error`, `deployment.check-finished`

**How to verify:**
```bash
# Using the script (requires VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID in .env)
npm run vercel-webhook:list
```

**Expected output:**
```
✅ Found 1 webhook(s):
   ID: hook_xxxxx
   URL: https://your-domain.vercel.app/api/webhooks/vercel-deployment
   Events: deployment.created, deployment.ready, deployment.error, deployment.check-finished
```

---

### 2️⃣ VERCEL_WEBHOOK_SECRET in Local Environment

**Check:** Your `.env` file should contain:
```env
VERCEL_WEBHOOK_SECRET="3KkLB/5/IlI/2akH6Unrlh1QtfG9zp53Dcf7vXjDnSY="
```

**How to verify:**
```bash
# Check if secret is set (without revealing value)
grep -q "VERCEL_WEBHOOK_SECRET" .env && echo "✅ Secret found in .env" || echo "❌ Secret NOT found"
```

---

### 3️⃣ VERCEL_WEBHOOK_SECRET in Vercel Production Environment

**Check:** Secret must be added to Vercel's environment variables

**How to add:**
```bash
# Link project first if not linked
vercel link

# Add to production
vercel env add VERCEL_WEBHOOK_SECRET production
# When prompted, paste: 3KkLB/5/IlI/2akH6Unrlh1QtfG9zp53Dcf7vXjDnSY=

# Add to preview
vercel env add VERCEL_WEBHOOK_SECRET preview
# When prompted, paste: 3KkLB/5/IlI/2akH6Unrlh1QtfG9zp53Dcf7vXjDnSY=
```

**Alternative: Via Vercel Dashboard**
1. Go to: `https://vercel.com/[your-username]/codemind/settings/environment-variables`
2. Click "Add New"
3. Name: `VERCEL_WEBHOOK_SECRET`
4. Value: `3KkLB/5/IlI/2akH6Unrlh1QtfG9zp53Dcf7vXjDnSY=`
5. Select: Production + Preview
6. Click "Save"

**How to verify:**
```bash
vercel env ls
# Should show VERCEL_WEBHOOK_SECRET in production and preview
```

---

### 4️⃣ Webhook Handler Deployed to Production

**Check:** The webhook endpoint must be live on your domain

**How to verify:**
```bash
# Test if endpoint exists (should return 405 Method Not Allowed for GET)
curl -X GET https://[your-domain].vercel.app/api/webhooks/vercel-deployment

# Expected: {"error":"Method not allowed","message":"This endpoint only accepts POST requests"}
```

**If not deployed:**
```bash
# Deploy to production
git push origin main
# Or manually deploy
vercel --prod
```

---

### 5️⃣ Required Environment Variables in Vercel

**Check:** These must be set in Vercel environment variables

**Required variables:**
- `VERCEL_WEBHOOK_SECRET` ✅ (added in step 3)
- `GITHUB_TOKEN` (for creating issues/PRs)
- `DATABASE_URL` (for saving auto-fix sessions)
- `OPENAI_API_KEY` (for AI analysis)

**How to verify:**
```bash
# Via Vercel CLI
vercel env ls

# Via Dashboard
# Go to: https://vercel.com/[your-username]/codemind/settings/environment-variables
```

---

### 6️⃣ Test Webhook Integration

**Option A: Trigger Test Deployment**
```bash
# Create a test branch
git checkout -b test/webhook-verification
echo "Test webhook" >> README.md
git add README.md
git commit -m "test: Trigger webhook"
git push origin test/webhook-verification
```

**Option B: Manual Webhook Test** (if webhook is visible in script)
```bash
# Get webhook ID first
npm run vercel-webhook:list

# Test webhook (replace WEBHOOK_ID)
npm run vercel-webhook:test WEBHOOK_ID
```

**What to look for:**
1. Deployment triggers in Vercel
2. Check Next.js logs for: `"Webhook received: deployment.created"` or similar
3. On deployment failure, check if auto-fix triggers

**View logs:**
```bash
# Via Vercel CLI
vercel logs

# Via Dashboard
# Go to: https://vercel.com/[your-username]/codemind/deployments
# Click on a deployment → Logs tab
```

---

## 🔍 Troubleshooting

### Issue: No webhooks found when running list command

**Possible causes:**
1. Webhook created via Vercel Dashboard UI instead of script
2. Missing VERCEL_TOKEN, VERCEL_PROJECT_ID, or VERCEL_TEAM_ID in .env
3. Token doesn't have correct permissions

**Solution:**
```bash
# Check if required vars are set
echo "Checking environment variables..."
grep "VERCEL_TOKEN" .env && echo "✅ VERCEL_TOKEN found" || echo "❌ Missing"
grep "VERCEL_PROJECT_ID" .env && echo "✅ VERCEL_PROJECT_ID found" || echo "❌ Missing"
grep "VERCEL_TEAM_ID" .env && echo "✅ VERCEL_TEAM_ID found" || echo "❌ Missing"

# If webhook was created in dashboard, it's still valid!
# Just verify in: https://vercel.com/[your-username]/codemind/settings/webhooks
```

---

### Issue: Webhook signature verification fails

**Cause:** VERCEL_WEBHOOK_SECRET mismatch

**Solution:**
1. Verify secret in .env matches what you used when creating webhook
2. Verify secret in Vercel environment variables matches
3. Redeploy after adding environment variable:
   ```bash
   vercel --prod
   ```

---

### Issue: Webhook not triggering

**Checks:**
1. ✅ Webhook endpoint is accessible: `https://[domain]/api/webhooks/vercel-deployment`
2. ✅ Endpoint returns valid response (even if error for GET request)
3. ✅ VERCEL_WEBHOOK_SECRET is set in Vercel environment
4. ✅ Deployment has been triggered after webhook setup

**Debug:**
```bash
# Check recent deployments
npm run fetch-vercel-logs -- --limit 5

# View deployment logs
vercel logs --follow
```

---

## 📊 Quick Verification Script

Run this to check all critical components:

\`\`\`bash
#!/bin/bash
echo "🔍 Vercel Webhook Configuration Check"
echo "========================================"
echo ""

# Check local environment
echo "1️⃣ Checking local .env file..."
grep -q "VERCEL_WEBHOOK_SECRET" .env && echo "   ✅ VERCEL_WEBHOOK_SECRET found" || echo "   ❌ VERCEL_WEBHOOK_SECRET missing"
grep -q "VERCEL_TOKEN" .env && echo "   ✅ VERCEL_TOKEN found" || echo "   ❌ VERCEL_TOKEN missing"
grep -q "VERCEL_PROJECT_ID" .env && echo "   ✅ VERCEL_PROJECT_ID found" || echo "   ❌ VERCEL_PROJECT_ID missing"
echo ""

# Check webhooks
echo "2️⃣ Checking Vercel webhooks..."
npm run vercel-webhook:list
echo ""

# Check recent deployments
echo "3️⃣ Checking recent deployments..."
npm run fetch-vercel-logs -- --limit 3
echo ""

echo "✅ Verification complete!"
echo ""
echo "📝 Next steps:"
echo "   1. If webhook not found in list, check Vercel dashboard manually"
echo "   2. Ensure VERCEL_WEBHOOK_SECRET is in Vercel environment variables"
echo "   3. Trigger a test deployment to verify webhook fires"
\`\`\`

Save this as `scripts/verify-webhook-setup.sh` and run:
```bash
chmod +x scripts/verify-webhook-setup.sh
./scripts/verify-webhook-setup.sh
```

---

## ✅ Success Criteria

Configuration is complete when:

- [x] Webhook visible in Vercel dashboard (or created via script)
- [ ] VERCEL_WEBHOOK_SECRET in local .env
- [ ] VERCEL_WEBHOOK_SECRET in Vercel production environment
- [ ] VERCEL_WEBHOOK_SECRET in Vercel preview environment
- [ ] Webhook handler deployed to production
- [ ] Webhook endpoint accessible (returns error for GET, accepts POST)
- [ ] Test deployment triggers webhook
- [ ] Webhook logs visible in Vercel deployment logs
- [ ] On failed deployment, auto-fix system triggers

---

## 📚 Additional Resources

- **Webhook Handler Code:** `src/app/api/webhooks/vercel-deployment/route.ts`
- **Configuration Script:** `scripts/configure-vercel-webhook.js`
- **Setup Guide:** `NEXT_STEPS.md`
- **Vercel Webhooks Docs:** https://vercel.com/docs/observability/webhooks-overview

---

**Status:** Ready for verification ✅  
**Next Task:** After verification, move to Task 3 (Configure Slack/Discord notifications)
