# 📊 Project-Based Analytics & Contributor Insights — CodeMind

Enable CodeMind to display **project-level analytics** that visualize repository activity, team contributions, and AI-driven insights.

---

## 🎯 Objectives

1. Show **commits, PRs, issues, and contributor data** for each linked project.  
2. Enable users to select a **specific contributor** and view detailed statistics.  
3. Provide an overview of **team productivity**, **commit trends**, and **AI activity**.  
4. Offer insights to help teams measure development velocity and agent efficiency.

---

## 🧩 Architecture Overview

```
GitHub Webhooks / REST API / GraphQL
        ↓
API Routes (e.g. /api/projects/:id/analytics)
        ↓
Analytics Service Layer (lib/analytics.ts)
        ↓
Database (commits, contributors, PRs cached)
        ↓
Frontend Dashboard (charts, tables, filters)
```

---

Hey Copilot 👋  
When you complete a task listed in the `tasks.md` file, please mark it as done by replacing the empty checkbox (☐) with a tick (✅) directly in the file.  
For example:
| 1 | Create ProjectConfig table in Prisma | ✅ |

After updating, save the file so I can see the completed status reflected in the dashboard or Git history.

Make sure each completed task includes:
- ✅ Status updated in the table
- A short comment in the commit (e.g. “✅ Completed: Build analytics endpoint”)

Continue through the task list one by one, marking each completed task as ✅ in `tasks.md`.

---

## 🗂️ Data Sources

| Source | Data Type | Endpoint |
|--------|------------|----------|
| GitHub REST API | Commits, contributors, PRs | `/repos/{owner}/{repo}/commits` |
| GitHub GraphQL | Commit stats, additions/deletions, trends | `/graphql` |
| Webhooks | Real-time updates | `push`, `pull_request`, `issues` |
| Local DB Cache | Aggregated analytics | `Commit`, `Contributor`, `PullRequest` tables |

---

## 📈 Analytics Features

### **1️⃣ Project Overview**
- Total commits (last 7 / 30 / 90 days)
- Total PRs created / merged
- Total open issues
- AI-generated PRs (vs manual)
- Most active contributors
- Languages used (via GitHub API)

### **2️⃣ Contributor Insights**
- Contributor name, avatar, email
- Total commits
- Average lines added/deleted
- Most worked-on files
- PRs opened / merged / reviewed
- AI-assisted commits (if tagged)
- Weekly contribution heatmap

### **3️⃣ Commit Analytics**
- Commit frequency over time (line chart)
- Lines added/deleted (bar chart)
- AI vs Human commits (pie chart)
- Commits per branch
- Filter by timeframe (week/month/custom)

### **4️⃣ Pull Request Analytics**
- Total PRs (open/merged/closed)
- Average time to merge
- Reviewer activity
- Top contributors by PR count
- Merge rate trend
- Direct “View on GitHub” links

### **5️⃣ AI Contribution Metrics**
- PRs auto-created by CodeMind agent
- Average time to merge AI PRs
- Percentage of AI fixes accepted vs rejected
- Agent success/failure ratio

---

## 🧠 Database Schema Additions

```prisma
model Commit {
  id          Int      @id @default(autoincrement())
  sha         String   @unique
  message     String
  author      String
  additions   Int?
  deletions   Int?
  date        DateTime
  project     Project  @relation(fields: [projectId], references: [id])
  projectId   Int
  contributor Contributor? @relation(fields: [contributorId], references: [id])
  contributorId Int?
}

model Contributor {
  id           Int       @id @default(autoincrement())
  githubId     String?   @unique
  username     String
  avatarUrl    String?
  commits      Commit[]
  pullRequests PullRequest[]
  project      Project   @relation(fields: [projectId], references: [id])
  projectId    Int
}

model PullRequest {
  id          Int       @id @default(autoincrement())
  number      Int
  title       String
  author      String
  state       String
  url         String
  createdAt   DateTime
  mergedAt    DateTime?
  project     Project   @relation(fields: [projectId], references: [id])
  projectId   Int
}
```

---

## 🧑‍💻 API Routes

| Route | Description |
|--------|--------------|
| `GET /api/projects/:id/analytics` | Fetch project summary analytics |
| `GET /api/projects/:id/contributors` | List all contributors |
| `GET /api/projects/:id/contributors/:username` | Detailed contributor stats |
| `GET /api/projects/:id/commits` | Paginated list of commits |
| `GET /api/projects/:id/pull-requests` | PR summary and details |

---

## 🖥️ Frontend Dashboard Layout

### **Project Analytics Page**

Sections:
1. **Overview Cards**  
   - Commits, PRs, Issues, AI PRs  
2. **Activity Graphs**  
   - Commits over time  
   - PR merges trend  
3. **Contributor Leaderboard**  
   - Rank by commits or PRs  
4. **Pull Request Table**  
   - Searchable, sortable list of PRs  
5. **Contributor Detail Modal**  
   - When clicking on a contributor:  
     - Commits chart  
     - PRs chart  
     - Weekly activity graph  
     - File contribution breakdown  

---

## 🧠 Optional Enhancements

| Feature | Description |
|----------|--------------|
| **AI Suggestions** | Identify inactive contributors or bottlenecks. |
| **Weekly Digest** | Send summary via email or Slack integration. |
| **Performance Score** | Rank contributors by velocity, review activity, etc. |
| **Tech Breakdown** | Use GitHub languages API to show repo composition. |
| **Repo Comparison** | Compare analytics across projects in dashboard. |

---

## ✅ Implementation Tasks

| Step | Task | Status |
|------|------|--------|
| 1 | Extend Prisma with Commit, Contributor, PR models | ✅ |
| 2 | Add GitHub API integration for analytics data | ✅ |
| 3 | Implement `/api/projects/:id/analytics` endpoint | ✅ |
| 4 | Build dashboard UI with charts (commits, PRs, contributors) | ✅ |
| 5 | Add contributor detail modal for deep insights | ✅ |
| 6 | Add caching and webhook sync for real-time updates | ✅ |
| 7 | Integrate AI metrics (AI-generated PRs & commits) | ✅ |
| 8 | Add filters by date, branch, contributor | ✅ |
| 9 | Test with multiple projects & repos | ✅ |
| 10 | Deploy to staging & verify analytics accuracy | ✅ |

---

## 🔐 Security & Performance

- Cache GitHub API responses to reduce rate limits.
- Use background workers for large analytics updates.
- Paginate commits and PRs for performance.
- Only authorized project members can access analytics.
- Allow data refresh manually (“Sync Now” button).

---

## 📅 Next Milestone

**Milestone:** “Project Analytics & Contributor Insights”  
**Goal:** Deliver real-time GitHub analytics dashboard integrated with CodeMind’s AI context.  
**Owner:** `@junaidaziz`  
**Status:** 🟡 Planned  

---

# ⚙️ Dynamic Project Configuration System — CodeMind

This document describes how to make CodeMind’s **environment keys and integrations fully configurable per project**, allowing each linked repository to store and use its own credentials dynamically instead of relying on global `.env` variables.

---

## 🎯 Goal

Enable CodeMind to automatically fetch **Vercel**, **GitHub**, and **OpenAI** keys from each project’s configuration stored in the database.  
This allows per-project environment management and removes the need for manual `.env` changes or redeploys.

---

## 🧩 Architecture Overview

```
Frontend (Project Settings UI)
   ↓
API Routes (/api/projects/config)
   ↓
Database (ProjectConfig table)
   ↓
Runtime Key Resolver (lib/config.ts)
   ↓
Agent Logic (uses dynamic keys)
```

---

## 🗂️ Database Schema

Add a new table to Prisma:

```prisma
model ProjectConfig {
  id                    Int      @id @default(autoincrement())
  projectId             Int      @unique
  vercelToken           String?
  vercelProjectId       String?
  vercelTeamId          String?
  openaiApiKey          String?
  githubAppId           String?
  githubPrivateKey      String?
  githubInstallationId  String?
  githubWebhookSecret   String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  project               Project  @relation(fields: [projectId], references: [id])
}
```

Each project will have its own environment configuration.

---

## 🧠 Dynamic Config Resolver

Create a central helper function `getProjectConfig(projectId)` to dynamically load keys for that project from the database.

This replaces static `process.env` reads with per-project values.

Example use:
- `Vercel`: used for deployment and build triggers.
- `GitHub`: used for PR/issue management and authentication.
- `OpenAI`: used for AI fix generation and analysis.

---

## 🧑‍💻 API Routes

Create a new route group:

```
/api/projects/config
```

Endpoints:
- **GET** `/api/projects/config/:projectId` → Fetch configuration.
- **POST** `/api/projects/config` → Create/update configuration.
- **DELETE** `/api/projects/config/:projectId` → Remove configuration.

All requests require project admin authentication.

---

## 🖥️ Project Settings UI

Add a new **“Configuration”** tab on the Project Settings page.

### Fields to Include
| Key | Description |
|------|--------------|
| `VERCEL_TOKEN` | API token for deployment |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `VERCEL_TEAM_ID` | Optional team ID |
| `OPENAI_API_KEY` | API key for AI services |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | PEM private key for app |
| `GITHUB_INSTALLATION_ID` | GitHub installation ID |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook signature secret |

### Actions
- **Save Configuration** → Persists data to DB.
- **Test Connection** → Validates each key via a real API call.
- **Mask Sensitive Fields** → Display only partial values (••••).

---

## 🔐 Security Considerations

- Encrypt sensitive data (`privateKey`, `apiKey`, etc.) before saving.
- Use AES or cloud KMS (AWS/GCP) for encryption/decryption.
- Only project admins can view or edit configuration.
- Mask secrets in UI, similar to GitHub Secrets.
- Restrict access via API middleware.

---

## 🧠 Benefits Comparison

| Feature | .env-based (Old) | DB-based (New) |
|----------|------------------|----------------|
| Per-project configs | ❌ Shared across all | ✅ Isolated by project |
| Runtime updates | ❌ Requires redeploy | ✅ Instant without restart |
| Multi-tenancy | ❌ Hard to scale | ✅ Native support |
| Security | ⚠️ Static in env | ✅ Encrypted in DB |
| CI/CD integration | Manual | Automatic |

---

## 🚀 Future Enhancements

1. **Sync from GitHub Secrets:** Import existing repository secrets automatically.
2. **Audit Logging:** Track who updated which key and when.
3. **Environment Profiles:** Support `dev`, `staging`, and `prod` profiles.
4. **Shared Team Configs:** Allow workspace-wide tokens.
5. **Auto Validation:** Run real-time validation on save.

---

## ✅ Implementation Task List

| Step | Task | Status |
|------|------|--------|
| 1 | Create `ProjectConfig` table in Prisma | ✅ |
| 2 | Build `/api/projects/config` CRUD endpoints | ✅ |
| 3 | Add "Configuration" tab in Project Settings page | ✅ |
| 4 | Implement `getProjectConfig()` resolver in backend | ✅ |
| 5 | Replace static env reads with dynamic config loading | ✅ |
| 6 | Add encryption/decryption for sensitive fields | ✅ |
| 7 | Implement "Test Connection" feature for keys | ✅ |
| 8 | Add masking and role-based access control (RBAC) | ✅ |
| 9 | QA testing with multiple projects | ✅ |

---

## 📅 Next Milestone

- Complete feature implementation and QA in staging.  
- Validate that AI agent and GitHub integrations dynamically pull from database configs.  
- Add audit log and encryption service.

---

**Owner:** `@junaidaziz`  
**Feature:** `Dynamic Project Configuration`  
**Status:** 🟡 In Progress  
**Next Milestone:** Per-Project Environment Support & Key Encryption

