# 🧠 Codemind – Full System Verification Checklist

This checklist ensures Codemind is fully connected, authenticated, and capable of reading, analyzing, fixing, and creating PRs automatically via GitHub App integration.

---

## ✅ 1. Environment & Secrets
**Goal:** All necessary environment variables are defined and valid.

### Core Environment Variables
- [ ] `.env` file exists at project root
- [ ] `DATABASE_URL` points to valid PostgreSQL database with pgvector extension
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` configured correctly
- [ ] `OPENAI_API_KEY` is valid and has sufficient credits/quota

### GitHub App Authentication
- [ ] `GITHUB_APP_ID` matches the GitHub App ID (visible in app settings)
- [ ] `GITHUB_INSTALLATION_ID` confirmed (get from installation URL or API)
- [ ] `GITHUB_PRIVATE_KEY` copied correctly from GitHub App (including BEGIN/END lines)
- [ ] `GITHUB_WEBHOOK_SECRET` matches the secret defined in GitHub App settings
- [ ] Optional: `GITHUB_TOKEN` for fallback authentication

### Development & Testing
- [ ] `CODEMIND_PROJECT_PATH` set for local code testing (optional)
- [ ] `NODE_ENV` set appropriately (`development` or `production`)
- [ ] `AGENT_SERVICE_URL` configured if using standalone agent service

### Verification Commands
```bash
# Test environment loading
npm run dev  # Should start without environment errors

# Check database connection
npx prisma db push --preview-feature

# Verify Supabase connection
curl "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_ANON_KEY"
```

---

## 🧠 2. GitHub App Configuration
**Goal:** GitHub App setup matches Codemind's requirements.

### App Creation & Basic Setup
- [ ] App created at https://github.com/settings/apps
- [ ] App name and description are clear and professional
- [ ] Homepage URL points to your Codemind deployment
- [ ] User authorization callback URL: `https://yourapp.com/auth/callback`

### Essential Permissions
- [ ] ✅ **Contents** → Read & Write (read files, create commits)
- [ ] ✅ **Pull Requests** → Read & Write (create/update PRs)
- [ ] ✅ **Actions** → Read (access workflow run logs)  
- [ ] ✅ **Checks** → Read (access check suite logs)
- [ ] ✅ **Metadata** → Read (repository metadata)
- [ ] ✅ **Issues** → Read & Write (optional, for issue management)

### Webhook Configuration
- [ ] Webhook URL: `https://yourapp.com/api/github/webhook`
- [ ] Webhook secret is generated and stored in environment
- [ ] SSL verification enabled
- [ ] Events subscribed to:
  - [ ] ✅ **Push** (code changes)
  - [ ] ✅ **Pull Request** (PR events)  
  - [ ] ✅ **Workflow Run** (CI/CD failures) 🔥
  - [ ] ✅ **Check Suite** (check failures) 🔥
  - [ ] ⚪ Issues (optional)
  - [ ] ⚪ Release (optional)

### Installation & Access
- [ ] App installed on target account/organization
- [ ] Repository access configured (all repos or selected)
- [ ] Installation ID captured (visible in URL after installation)

### Verification Steps
```bash
# Test GitHub App authentication
curl -H "Authorization: Bearer $(gh auth token)" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/app

# Check installation
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/app/installations
```

---

## 🧠 3. Database & Schema Validation
**Goal:** Database schema supports auto-fix functionality.

### Core Tables
- [ ] `projects` table exists with required columns
- [ ] `messages` table for chat/webhook logs  
- [ ] `AutoFixSession` table for tracking auto-fix attempts
- [ ] `AutoFixResult` table for fix outcomes

### Auto-Fix Schema Validation
```sql
-- Verify auto-fix tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('AutoFixSession', 'AutoFixResult');

-- Check required columns
DESCRIBE "AutoFixSession";
DESCRIBE "AutoFixResult";
```

### Prisma Validation
- [ ] `prisma/schema.prisma` includes auto-fix models
- [ ] Prisma client generated: `npx prisma generate`
- [ ] Migrations applied: `npx prisma db push`

### Test Database Operations
```bash
# Test database connection
npx prisma studio  # Should open without errors

# Verify project creation
npm run test -- --testNamePattern="should create project"
```

---

## 🧠 4. Webhook Endpoint Testing
**Goal:** Webhook endpoint correctly processes GitHub events.

### Local Testing Setup
- [ ] Use ngrok or similar for local webhook testing
- [ ] Update GitHub App webhook URL to tunnel URL
- [ ] Verify webhook secret matches environment

### Test Event Processing
```bash
# Test webhook endpoint directly
curl -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "x-github-event: push" \
  -H "x-github-delivery: test-123" \
  -d '{"repository":{"html_url":"https://github.com/test/repo"}}'
```

### Event Type Validation
- [ ] **Push events** → Trigger reindexing
- [ ] **PR events** → Queue analysis jobs
- [ ] **Workflow run failures** → Trigger auto-fix 🔥
- [ ] **Check suite failures** → Trigger auto-fix 🔥
- [ ] **Unknown events** → Graceful handling

### Response Validation
- [ ] 200 status for valid events
- [ ] 404 for unknown repositories  
- [ ] 400 for malformed payloads
- [ ] Proper error logging

---

## 🧠 5. Auto-Fix Pipeline Validation
**Goal:** Complete auto-fix workflow functions end-to-end.

### Log Analysis Testing
```bash
# Test log analyzer with sample TypeScript error
npm run test -- --testNamePattern="should analyze TypeScript errors"

# Test structured error extraction  
npm run test -- --testNamePattern="should extract structured errors"
```

### GitHub API Integration
- [ ] Can fetch workflow run logs via GitHub API
- [ ] Can fetch check suite logs via GitHub API
- [ ] Proper authentication handling
- [ ] Rate limit handling

### Auto-Fix Generation
- [ ] Pattern matching detects common errors:
  - [ ] TypeScript import/path errors
  - [ ] Missing environment variables
  - [ ] Prisma schema issues
  - [ ] Supabase configuration errors
- [ ] AI analysis provides intelligent suggestions
- [ ] Fix generation creates appropriate file changes

### PR Creation Testing
```javascript
// Test auto-fix PR creation
const result = await autoFix.createFixPR(
  projectId,
  githubUrl, 
  detectedIssues,
  fileChanges,
  userId
);

expect(result.success).toBe(true);
expect(result.prUrl).toMatch(/github\.com.*\/pull\/\d+/);
```

---

## 🧠 6. End-to-End Workflow Testing
**Goal:** Complete workflow from webhook to PR creation works.

### Manual Test Scenario
1. **Create test failure** in monitored repository
2. **Trigger workflow** that will fail (e.g., TypeScript error)
3. **Verify webhook received** in Codemind logs
4. **Check auto-fix triggered** via database or logs
5. **Confirm PR created** on GitHub with appropriate fixes

### Automated Integration Tests
```bash
# Run webhook integration tests
npm run test -- src/tests/webhook-auto-fix.integration.test.ts

# Run complete auto-fix pipeline tests  
npm run test -- --testNamePattern="auto-fix.*integration"
```

### Test Cases to Validate
- [ ] **TypeScript import error** → PR with tsconfig path fix
- [ ] **Missing env variable** → PR with .env.example update  
- [ ] **Prisma schema error** → PR with schema correction
- [ ] **Multiple errors** → PR with multiple fixes
- [ ] **No fixable errors** → No PR created
- [ ] **API failures** → Graceful error handling

---

## 🧠 7. Production Deployment Verification
**Goal:** System works correctly in production environment.

### Environment Setup
- [ ] Production environment variables configured
- [ ] Database accessible from production
- [ ] GitHub App webhook points to production URL
- [ ] SSL certificate valid for webhook URL

### Performance & Reliability
- [ ] Webhook endpoint responds within 10 seconds
- [ ] Database operations complete successfully
- [ ] GitHub API calls handle rate limits
- [ ] Error logging captures issues appropriately

### Monitoring & Alerting
```bash
# Check application logs
tail -f /var/log/codemind/app.log

# Monitor webhook events
grep "GitHub webhook" /var/log/codemind/app.log

# Track auto-fix success rate
SELECT 
  COUNT(*) as total_attempts,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
  AVG(CASE WHEN success = true THEN 1 ELSE 0 END) * 100 as success_rate
FROM "AutoFixResult";
```

### Health Checks
- [ ] `/api/health` endpoint returns 200
- [ ] Database health check passes
- [ ] GitHub API connectivity confirmed
- [ ] Auto-fix pipeline status available

---

## 🧠 8. Security & Best Practices
**Goal:** System follows security best practices.

### Authentication Security
- [ ] Private keys stored securely (not in version control)
- [ ] Webhook signatures validated
- [ ] API endpoints protected appropriately
- [ ] Database access restricted

### GitHub Permissions
- [ ] App has minimal necessary permissions
- [ ] Repository access scoped appropriately  
- [ ] Webhook events limited to required types
- [ ] Token rotation plan in place

### Code Security
- [ ] No secrets in environment files committed to git
- [ ] Input validation on all webhook payloads
- [ ] SQL injection protection (Prisma ORM)
- [ ] XSS protection on user inputs

---

## ✅ Complete System Test

Run this comprehensive test to verify everything works:

```bash
# 1. Start the application
npm run dev

# 2. Run all integration tests
npm run test -- --testNamePattern="integration|webhook|auto-fix"

# 3. Test webhook endpoint
curl -X POST http://localhost:3000/api/health

# 4. Verify GitHub App connectivity
npm run test -- --testNamePattern="github.*auth"

# 5. Test complete auto-fix pipeline
npm run test -- src/tests/webhook-auto-fix.integration.test.ts
```

### Success Criteria
- [ ] All tests pass ✅
- [ ] No authentication errors ✅
- [ ] Webhook events process correctly ✅
- [ ] Auto-fix pipeline completes end-to-end ✅
- [ ] PRs created successfully on GitHub ✅

---

## 🚨 Troubleshooting Common Issues

### "Cannot authenticate with GitHub"
- Verify `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY`
- Check GitHub App installation status
- Confirm repository access permissions

### "Webhook not receiving events"  
- Verify webhook URL is accessible publicly
- Check webhook secret matches environment
- Confirm events are subscribed in GitHub App settings

### "Auto-fix not triggering"
- Check workflow_run/check_suite events are enabled
- Verify project exists in database for repository
- Check logs for GitHub API rate limiting

### "PR creation fails"
- Confirm Contents and Pull Requests permissions
- Check branch protection rules  
- Verify authentication scope includes repository access

---

**🎯 Once all items are checked, Codemind is fully operational and ready to automatically fix code issues via GitHub integration!**