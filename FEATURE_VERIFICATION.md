# 🧠 Codemind – Full Feature Verification Checklist

This master checklist ensures Codemind's features — from GitHub App setup to auto-fix and PR generation — are working end-to-end.

---

## ⚙️ 1. Environment & Secrets
- [ ] `.env` file exists and loads correctly.
- [ ] `GITHUB_APP_ID` matches your GitHub App.
- [ ] `GITHUB_INSTALLATION_ID` confirmed from app installation URL or API.
- [ ] `GITHUB_PRIVATE_KEY` or `GITHUB_PRIVATE_KEY_BASE64` added correctly.
- [ ] `GITHUB_WEBHOOK_SECRET` matches webhook configuration.
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` configured.
- [ ] `CODEMIND_PROJECT_PATH` points to the local repo.
- [ ] App boots with `npm run dev` without env errors.

---

## 🧠 2. GitHub App Configuration
- [ ] App created in **GitHub Developer Settings**.
- [ ] Installed on correct user/org account.
- [ ] Permissions granted:
  - [ ] ✅ Contents → Read & Write  
  - [ ] ✅ Pull Requests → Read & Write  
  - [ ] ✅ Workflows → Read & Write  
  - [ ] ✅ Metadata → Read-only  
- [ ] Webhook URL set to `/api/github/webhook`.
- [ ] Webhook secret matches `.env`.
- [ ] Subscribed events include:
  - [ ] Push  
  - [ ] Pull Request  
  - [ ] Workflow Run  

---

## 🔐 3. Authentication Verification
- [ ] Run `scripts/test-github-auth.ts` — lists accessible repositories.
- [ ] No `401` or `403` authentication issues.
- [ ] Octokit initialized correctly using `createAppAuth`.
- [ ] Installation tokens generated successfully.

---

## 🌐 4. Webhook Verification
- [ ] `/api/github/webhook` endpoint deployed and reachable.
- [ ] Incoming requests include `x-hub-signature-256`.
- [ ] Signature verified using HMAC-SHA256 with `GITHUB_WEBHOOK_SECRET`.
- [ ] Event logs display event name (`push`, `pull_request`, `workflow_run`).
- [ ] Test webhook delivery returns `200 OK`.
- [ ] Logs recorded in Supabase or console.

---

## 🧩 5. Full Repository Indexing
- [ ] `repoScanner.ts` recursively scans repo files.
- [ ] `fullIndexProject.ts` processes and stores embeddings.
- [ ] `ProjectFile` table populated with metadata.
- [ ] Incremental re-indexing works (only changed files updated).
- [ ] Tested locally:
  ```bash
  npm run codemind:index
  ```

---

## 🔍 6. Semantic Search & Embeddings
- [ ] OpenAI embeddings generated for code chunks.
- [ ] Vector similarity search returns relevant results.
- [ ] `/api/projects/[id]/search` endpoint functional.
- [ ] Search queries return ranked file matches.
- [ ] Test search with project-specific queries.

---

## 💬 7. Chat & AI Integration
- [ ] `/api/chat` endpoint processes messages.
- [ ] OpenAI API key valid and quota available.
- [ ] Chat context includes repository files.
- [ ] Responses reference specific code files.
- [ ] Chat history persisted in database.
- [ ] Test chat interface loads without errors.

---

## 🔧 8. Auto-Fix Pipeline
- [ ] Log analysis detects common error patterns:
  - [ ] TypeScript import errors (`TS2307`)
  - [ ] Missing environment variables
  - [ ] Prisma connection issues (`P1001`)
  - [ ] Supabase authentication errors
- [ ] Auto-fix suggestions generated automatically.
- [ ] File changes created for detected issues.
- [ ] PR creation triggered via GitHub API.
- [ ] Test with sample error logs:
  ```bash
  npm run test:auto-fix
  ```

---

## 📡 9. Webhook Auto-Fix Integration
- [ ] Webhook events trigger auto-fix pipeline:
  - [ ] `workflow_run` failures → log analysis → PR creation
  - [ ] `check_suite` failures → error detection → fixes
- [ ] GitHub API fetches workflow logs automatically.
- [ ] Failed CI/CD builds trigger immediate response.
- [ ] Auto-fix PRs created with meaningful titles/descriptions.
- [ ] Test webhook simulation:
  ```bash
  curl -X POST http://localhost:3000/api/github/webhook \
    -H "Content-Type: application/json" \
    -H "x-github-event: workflow_run" \
    -d '{"action":"completed","workflow_run":{"conclusion":"failure"}}'
  ```

---

## 🏗️ 10. CI Integration & Deployment
- [ ] GitHub Actions workflow configured (`.github/workflows/`).
- [ ] Vercel deployment configured with environment secrets.
- [ ] Production webhook URL points to deployed app.
- [ ] Database migrations run successfully.
- [ ] Production logs accessible and monitored.

---

## 🧪 11. End-to-End Testing
- [ ] Create test repository with intentional errors.
- [ ] Push code changes to trigger webhook.
- [ ] Verify workflow failure detection.
- [ ] Confirm auto-fix PR creation.
- [ ] Test PR merge and re-indexing.
- [ ] Validate chat queries work with updated code.

---

## 📊 12. Performance & Monitoring
- [ ] API response times under 5 seconds.
- [ ] Database queries optimized with indexes.
- [ ] OpenAI API usage within limits.
- [ ] Error tracking and alerting configured.
- [ ] Usage analytics dashboard functional.

---

## 🔒 13. Security Verification
- [ ] Webhook signatures validated properly.
- [ ] GitHub tokens secured and rotated.
- [ ] Database access restricted by environment.
- [ ] No secrets exposed in client-side code.
- [ ] API endpoints protected against unauthorized access.

---

## ✅ 14. Final Validation
- [ ] All core features working end-to-end.
- [ ] Documentation up-to-date and accurate.
- [ ] Production deployment stable and monitored.
- [ ] Backup and recovery procedures tested.
- [ ] Team onboarding materials available.

---

## 🚨 Troubleshooting Common Issues

### Authentication Errors
```bash
# Test GitHub App authentication
node -e "
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');
const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
    installationId: process.env.GITHUB_INSTALLATION_ID,
  },
});
octokit.rest.apps.getAuthenticated().then(console.log).catch(console.error);
"
```

### Webhook Issues
```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "x-github-event: ping" \
  -d '{"zen":"Keep it logically awesome."}'
```

### Database Connection
```bash
# Test Supabase connection
npx prisma db push --preview-feature
npx prisma studio
```

### OpenAI Integration
```bash
# Test embeddings generation
node -e "
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'test embedding'
}).then(r => console.log('✅ OpenAI working')).catch(console.error);
"
```

---

**🎯 Once all items are checked, Codemind is fully operational with automatic code analysis, error detection, and intelligent PR generation!**