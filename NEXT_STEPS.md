# 🎯 Next Steps: Complete Vercel Integration

## ✅ What We've Completed

1. **Webhook Handler** - `src/app/api/webhooks/vercel-deployment/route.ts` ✅
2. **Log Fetcher Script** - `scripts/fetch-vercel-logs.js` (tested & working) ✅
3. **Webhook Configuration Script** - `scripts/configure-vercel-webhook.js` ✅
4. **Environment Setup** - VERCEL_WEBHOOK_SECRET configured ✅
5. **NPM Scripts** - Added to package.json ✅
6. **Documentation** - VERCEL_WEBHOOK_SETUP.md, VERCEL_INTEGRATION_STATUS.md ✅

## 🔴 Action Required: Configure Webhook

### Step 1: Get Your Vercel Deployment URL

You need your production or preview URL. Choose one:

**Option A: Production URL (Recommended)**
```bash
# Find your production URL in Vercel dashboard or via CLI
vercel ls --prod
```

**Option B: Check Recent Deployments**
```bash
npm run fetch-vercel-logs -- --limit 1
# Look for the 'url' field in the output
```

### Step 2: Configure Webhook Programmatically

Once you have your domain, run:

```bash
# Replace YOUR-DOMAIN with your actual Vercel domain
node scripts/configure-vercel-webhook.js --url https://YOUR-DOMAIN.vercel.app/api/webhooks/vercel-deployment
```

**Example:**
```bash
node scripts/configure-vercel-webhook.js --url https://codemind-abc123.vercel.app/api/webhooks/vercel-deployment
```

The script will:
- ✅ Create webhook in Vercel
- ✅ Configure all deployment events
- ✅ Set the secret automatically from .env
- ✅ Verify configuration

### Step 3: Add Secret to Vercel Environment

The webhook endpoint needs access to the secret in production:

```bash
# Add to production environment
vercel env add VERCEL_WEBHOOK_SECRET production
# When prompted, paste: 3KkLB/5/IlI/2akH6Unrlh1QtfG9zp53Dcf7vXjDnSY=

# Add to preview environment
vercel env add VERCEL_WEBHOOK_SECRET preview
# When prompted, paste: 3KkLB/5/IlI/2akH6Unrlh1QtfG9zp53Dcf7vXjDnSY=
```

### Step 4: Deploy to Production

Deploy the webhook handler to Vercel:

```bash
# Option 1: Push to main branch (triggers auto-deployment)
git checkout main
git merge test/ci-cd-verification
git push origin main

# Option 2: Manual deployment via Vercel CLI
vercel --prod
```

### Step 5: Test the Webhook

After deployment, test it:

```bash
# List webhooks to get the webhook ID
npm run vercel-webhook:list

# Test the webhook (replace WEBHOOK_ID with actual ID from above)
npm run vercel-webhook:test WEBHOOK_ID

# Or trigger a real failed deployment
git checkout -b test/webhook
# Make a small breaking change (e.g., syntax error)
git commit -am "test: trigger failed deployment"
git push origin test/webhook
```

### Step 6: Monitor Webhook Activity

Check logs to verify webhook is receiving events:

```bash
# View Next.js logs in Vercel dashboard
# Look for: "Webhook received: deployment.failed"

# Or use Vercel CLI
vercel logs
```

## 📊 Verification Checklist

- [ ] Get Vercel deployment URL
- [ ] Run configure-vercel-webhook.js script
- [ ] Add VERCEL_WEBHOOK_SECRET to Vercel environment (production + preview)
- [ ] Deploy webhook handler to production
- [ ] Test webhook with deployment
- [ ] Verify logs show webhook events
- [ ] Confirm auto-fix triggers on failures

## 🚀 Quick Commands Reference

```bash
# List existing webhooks
npm run vercel-webhook:list

# Create webhook (replace URL)
node scripts/configure-vercel-webhook.js --url https://YOUR-DOMAIN.vercel.app/api/webhooks/vercel-deployment

# Delete webhook (if needed)
npm run vercel-webhook:delete WEBHOOK_ID

# Test webhook
npm run vercel-webhook:test WEBHOOK_ID

# Fetch recent failed deployments
npm run fetch-vercel-logs:errors

# Trigger auto-fix manually
npm run fetch-vercel-logs:auto-fix
```

## 🔧 Troubleshooting

### Issue: Don't know my Vercel URL
**Solution:**
1. Go to https://vercel.com/dashboard
2. Click on your project
3. Look for "Domains" section
4. Use the `.vercel.app` domain

### Issue: Webhook signature verification fails
**Solution:**
1. Verify VERCEL_WEBHOOK_SECRET is identical in:
   - Local `.env` file
   - Webhook configuration
   - Vercel environment variables
2. Redeploy after adding environment variable

### Issue: Webhook not triggering
**Solution:**
1. Check webhook is created: `npm run vercel-webhook:list`
2. Verify webhook URL is accessible (HTTPS required)
3. Check Vercel dashboard → Settings → Webhooks
4. Look for failed delivery attempts

## 📚 Additional Resources

- **Webhook Handler Code:** `src/app/api/webhooks/vercel-deployment/route.ts`
- **Configuration Script:** `scripts/configure-vercel-webhook.js`
- **Setup Guide:** `VERCEL_WEBHOOK_SETUP.md`
- **Status Document:** `VERCEL_INTEGRATION_STATUS.md`
- **Vercel Webhooks Docs:** https://vercel.com/docs/observability/webhooks-overview

---

**Ready to proceed?** Run the commands above to complete the Vercel integration! 🎉
