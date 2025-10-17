# Vercel Webhook Setup Guide

**Date:** 17 October 2025  
**Status:** 🔄 Ready to Configure

## Step 1: Generate Webhook Secret

Run this command to generate a secure webhook secret:

```bash
openssl rand -base64 32
```

**Generated Secret (save this):**
```
[Run the command above to generate your secret]
```

## Step 2: Add Secret to Environment Variables

### Local Development (.env)
```bash
echo "VERCEL_WEBHOOK_SECRET=your_generated_secret_here" >> .env
```

### Vercel Dashboard
1. Go to: https://vercel.com/[your-team]/codemind/settings/environment-variables
2. Add new environment variable:
   - **Name:** `VERCEL_WEBHOOK_SECRET`
   - **Value:** [paste your generated secret]
   - **Environment:** Production, Preview, Development (select all)
3. Click "Save"

### GitHub Secrets (for CI/CD)
1. Go to: https://github.com/junaidaziz/codemind/settings/secrets/actions
2. Click "New repository secret"
3. Add:
   - **Name:** `VERCEL_WEBHOOK_SECRET`
   - **Value:** [paste your generated secret]

## Step 3: Configure Webhook in Vercel

1. **Go to Vercel Project Settings:**
   - URL: https://vercel.com/[your-team]/codemind/settings/webhooks

2. **Click "Add Webhook"**

3. **Configure Webhook:**
   ```
   URL: https://your-domain.vercel.app/api/webhooks/vercel-deployment
   
   Events to Subscribe:
   ✓ deployment.created
   ✓ deployment.succeeded  
   ✓ deployment.failed
   ✓ deployment.error
   
   Secret: [paste your generated secret]
   ```

4. **Click "Create Webhook"**

## Step 4: Verify Webhook Endpoint

Test the webhook endpoint is live:

```bash
curl https://your-domain.vercel.app/api/webhooks/vercel-deployment
```

Expected response:
```json
{
  "success": true,
  "data": {
    "message": "Vercel deployment webhook endpoint is active",
    "timestamp": "2025-10-17T..."
  }
}
```

## Step 5: Test Webhook

### Option A: Trigger via Failed Deployment
1. Push a commit with intentional error
2. Wait for deployment to fail
3. Check webhook is triggered
4. Verify auto-fix is created

### Option B: Manual Test with curl
```bash
# Generate test signature
SECRET="your_webhook_secret"
PAYLOAD='{"id":"evt_test","type":"deployment.failed","payload":{"deployment":{"id":"dpl_test"}}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha1 -hmac "$SECRET" | cut -d' ' -f2)

# Send test webhook
curl -X POST https://your-domain.vercel.app/api/webhooks/vercel-deployment \
  -H "Content-Type: application/json" \
  -H "x-vercel-signature: sha1=$SIGNATURE" \
  -d "$PAYLOAD"
```

## Verification Checklist

- [ ] Webhook secret generated
- [ ] Secret added to `.env` file
- [ ] Secret added to Vercel environment variables
- [ ] Secret added to GitHub Secrets
- [ ] Webhook created in Vercel dashboard
- [ ] Webhook endpoint responds successfully
- [ ] Test webhook with failed deployment
- [ ] Verify auto-fix is triggered
- [ ] Check logs show webhook received

## Webhook Configuration Details

**Endpoint:** `/api/webhooks/vercel-deployment`  
**Method:** POST  
**Authentication:** HMAC SHA256 signature verification  
**Handler:** `src/app/api/webhooks/vercel-deployment/route.ts`

### What the Webhook Does:

1. **Receives deployment event** from Vercel
2. **Verifies signature** using VERCEL_WEBHOOK_SECRET
3. **Checks deployment status** (failed/error)
4. **Fetches deployment logs** from Vercel API
5. **Triggers auto-fix** via `/api/github/auto-fix`
6. **Creates GitHub issue** with analysis
7. **Generates PR** with proposed fix

## Troubleshooting

### Webhook Not Receiving Events
- Check webhook URL is correct
- Verify VERCEL_WEBHOOK_SECRET is set in Vercel
- Check webhook is enabled in Vercel dashboard
- Review application logs for signature errors

### Signature Verification Fails
- Ensure VERCEL_WEBHOOK_SECRET matches in both places
- Check secret has no extra whitespace
- Verify webhook handler is using correct algorithm (SHA256)

### Auto-Fix Not Triggering
- Check `/api/github/auto-fix` endpoint is accessible
- Verify GitHub credentials are configured
- Review webhook handler logs for errors
- Ensure project is linked in database

## Next Steps After Setup

Once webhook is configured and tested:

1. ✅ Monitor webhook events in Vercel dashboard
2. ✅ Check auto-fix sessions are created
3. ✅ Verify GitHub issues/PRs are generated
4. ✅ Test with real deployment failures
5. ✅ Document any issues encountered

---

**Status:** Ready to configure  
**Estimated Time:** 15-20 minutes  
**Documentation:** See `docs/VERCEL_INTEGRATION.md` for detailed guide
