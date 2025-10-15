# 📊 CodeMind
# 🤖 CodeMind — Automatic Fix Orchestration System

This feature introduces **end-to-end automated AI code fixes** that can analyze issues, generate validated patches, and open pull requests — all through chat or system triggers.

---

## 🧭 Overview

### **Goal**
Automate the full lifecycle of a code fix:
1. Interpret user intent (chat command or issue)
2. Retrieve relevant code context
3. Generate minimal patch (diff)
4. Validate (lint, tests, typecheck)
5. Commit and create a pull request automatically

---

## 🧩 Current State

## ⚙️ New Components to Implement

| Component | Purpose | File / Location |
|------------|----------|----------------|
| **Command Parser** | Detect `/fix` or “fix issue #123” messages | `agent-router.ts` or `chat-commands.ts` |
| **AutoFix Orchestrator** | Coordinates the workflow end-to-end | `auto-fix-orchestrator.ts` |
| **Patch Engine** | Applies diffs, handles conflicts, creates rollbacks | `lib/patch-engine.ts` |
| **Git Workspace Manager** | Manages clone, branch, commit, push | `lib/git-workspace.ts` |
| **Validation Runner** | Lint, typecheck, and run tests | `lib/validation-runner.ts` |
| **PR Creator** | Creates pull request and links to issue | `github-service.ts` |
| **Chat Integration** | Sends progress updates back to chat | Message pipeline extension |

---

## 🔄 Auto Fix Session Lifecycle

1. **Trigger**
   - User: “/fix issue #123” or “fix the login error”
   - System: CI failure hook

2. **Scope Resolution**
   - Map issue → related files via embeddings or search.

3. **Analysis**
   - Summarize root cause and propose change plan.

4. **Patch Generation**
   - Generate a minimal unified diff for one or more files.

5. **Validation**
   - Apply patch in temp branch, run lint + typecheck + tests.

6. **Pull Request**
   - Commit & push if validated, open PR, link to issue.

7. **Session Update**
   - Update `AutoFixSession.status` → `COMPLETED` or `FAILED`.

---

## ⚙️ Data Model Enhancements

| Model | Field | Purpose |
|--------|--------|----------|
| `AutoFixSession` | `diffSummary` | Store summary of proposed fix |
| `AutoFixResult` | `hunkPreview` | Store diff snippet for review |
| `AutoFixSession` | `prUrl` | Link created pull request |
| `ActivityLog` | `action` / `details` | Record each workflow stage |

---

## 🧩 Phased Implementation Plan

### **Phase 1 — Command Parsing & Session Creation**
- [ ] Detect chat commands `/fix` or “fix issue #N”
- [ ] Create new `AutoFixSession` (status = `PENDING`)
- [ ] Respond in chat: “AI Fix session started for issue #N”
- [ ] Log activity event

### **Phase 2 — Analysis & Plan**
- [ ] Retrieve issue details (title, description)
- [ ] Retrieve relevant code chunks (via embeddings + keyword search)
- [ ] Generate fix plan (no patch yet)
- [ ] Update session status → `ANALYZING`
- [ ] Return summary to chat: “Plan generated — Proceed?”

### **Phase 3 — Patch Generation**
- [ ] On approval → prompt LLM to create unified diff (single-file first)
- [ ] Validate diff format
- [ ] Store diff in `AutoFixResult`
- [ ] Display diff preview in chat (Proceed / Cancel)

### **Phase 4 — Apply & Validate**
- [ ] Apply patch in ephemeral git workspace
- [ ] Run `lint`, `typecheck`, and small test subset
- [ ] On success → commit + push new branch
- [ ] Create pull request via GitHub API
- [ ] Update session status → `COMPLETED`
- [ ] On failure → attach logs and retry up to 2 times

### **Phase 5 — Policy & Automation**
- [ ] Implement `AutoFixConfig.requireApproval`
- [ ] Allow auto-proceed for low-risk categories (lint/style fixes)
- [ ] Integrate CI test results to trigger new fixes automatically
- [ ] Add rate limiting per project

---

## 🧰 Supporting Modules

| Module | Task | Status |
|---------|------|--------|
| `patch-engine.ts` | Apply unified diffs safely | ☐ |
| `git-workspace.ts` | Clone, branch, commit, push | ☐ |
| `validation-runner.ts` | Lint, typecheck, test subset | ☐ |
| `auto-fix-orchestrator.ts` | Coordinate workflow | ☐ |
| `chat-commands.ts` | Parse chat commands | ☐ |
| `github-service.ts` | Create pull requests | ☐ |
| `activity-log.ts` | Log workflow events | ☐ |

---

## 🧩 Validation Strategy

- [ ] Run only tests touching changed files (dependency map)
- [ ] Capture logs and attach to chat
- [ ] Abort if patch > max allowed size
- [ ] Include dry-run toggle (generate diff only)
- [ ] Tag AI-generated PRs with `ai-fix` label

---

## 🔐 Safety Configs (in ProjectConfig)

| Field | Description |
|--------|--------------|
| `maxPatchLines` | Limit for changes per patch |
| `requireApproval` | Require user approval before apply |
| `maxOpenFixes` | Prevent flooding PRs |
| `allowedPaths` | Optional safe directories |
| `aiFixBranchPrefix` | Default branch naming convention |

---

## 📊 Metrics & Observability

- Track:
  - Total AI fixes attempted
  - Success rate (% passing validation)
  - Avg time per fix
  - Token usage per fix
- Add correlation ID (session.id) to all logs
- Log major transitions:
  - ANALYZING → FIXING → CREATING_PR → COMPLETED

---

## Incremental Rollout Plan

| Phase | Description | Goal |
|--------|-------------|------|
| 1 | `/fix` command recognition | Acknowledge request |
| 2 | Analysis plan generation | Human-approved scope |
| 3 | Diff generation & preview | Review diff safely |
| 4 | Apply + validate + PR | Full automation |
| 5 | Metrics + automation policies | Smart continuous fixes |

---

## 📅 Next Milestones

| Milestone | Focus | ETA |
|------------|--------|-----|
| `AutoFix Phase 1` | Command detection & session creation | ✅ Immediate |
| `AutoFix Phase 2` | Analysis + plan summary | 🔜 Next |
| `AutoFix Phase 3` | Patch & diff preview | ☐ Planned |
| `AutoFix Phase 4` | Apply, validate & PR | ☐ Planned |
| `AutoFix Phase 5` | Metrics & continuous improvement | ☐ Final Stage |

---

**Owner:** `@junaidaziz`  
**Feature:** `Automatic AI Code Fix Orchestration`  
**Status:** 🟡 In Progress  
**Next Immediate Task:** Implement **Phase 1 — Command Parsing & Session Creation**
