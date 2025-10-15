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

### Pending Roadmap (Open Items Only)

#### Phase 2 — Analysis & Plan (Remaining)
- [ ] Integrate vector similarity retrieval
- [ ] Add explicit user confirmation / proceed gating (refine existing commands)
- [ ] Activity logging & metrics for analysis phase

#### Phase 3 — Patch Generation, Validation & Apply (Remaining)
- [ ] Real apply hardening (branch/PR only if validation passes & token present)
- [ ] Activity logging for APPLY_COMPLETED / APPLY_FAILED with validation summary
- [ ] LLM diff generation (replace stubs with real model-driven edits)
- [ ] Regenerate / cancel commands
- [ ] Enhanced validation: real ESLint, TypeScript compile, focused Jest subset
- [ ] Documentation refinement (detailed validation pipeline, failure states)

#### Safety & Limits
- [ ] Patch size limit (lines + bytes)
- [ ] Per-file LOC delta threshold
- [ ] Allowed path filters & risk classification

#### Workflow Reliability
- [ ] Ephemeral git workspace apply (sandbox before branch commit)
- [ ] Retry logic (configurable attempts) with backoff for transient failures

#### Phase 5 — Policy & Automation
- [ ] Implement `AutoFixConfig.requireApproval`
- [ ] Auto-proceed for low-risk categories (style, comment)
- [ ] CI failure triggers automatic session creation
- [ ] Rate limiting per project

#### Supporting Modules (Unbuilt / Partial)
- [ ] `patch-engine.ts` advanced diff (multi-hunk, conflict detection)
- [ ] `git-workspace.ts` sandbox clone & branch ops
- [ ] `validation-runner.ts` real execution (currently simulated only)
- [ ] `github-service.ts` robust PR metadata (labels, draft toggle, reviewers)
- [ ] `activity-log.ts` structured lifecycle events

#### Validation Strategy (Open)
- [ ] Change impact graph to select minimal test subset
- [ ] Attach validation logs/artifacts to session
- [ ] Abort if patch exceeds size/risk threshold
- [ ] Dry-run toggle (diff only)
- [ ] Tag AI PRs with `ai-fix` label

#### Metrics & Observability
- [ ] Track token usage per stage
- [ ] Success rate & MTTR dashboards
- [ ] Correlation ID in all logs (session.id)
- [ ] Transition logging: ANALYZING → FIXING → CREATING_PR → COMPLETED/FAILED

#### Feature Flags / Env (Planned / Enforcement Pending)
- AUTOFIX_MULTI_MAX_FILES (implemented)
- AUTOFIX_MULTI_MAX_LOC_DELTA (implemented)
- AUTOFIX_LLM_ENABLED (planned for real LLM calls)
- [ ] Flag to enable real validation (e.g., AUTOFIX_REAL_VALIDATION)
- [ ] Risk threshold flag (e.g., AUTOFIX_MAX_LOC_PCT)

#### Immediate Focus Candidates
- [ ] Real LLM wiring
- [ ] Validation hardening
- [ ] Activity logging (apply + validation)
- [ ] Regenerate / cancel commands

<!-- Completed items pruned for clarity. -->

---

## 🧰 Supporting Modules

| Module | Task | Status |
|---------|------|--------|
| `patch-engine.ts` | Apply unified diffs safely | ☐ |
| `git-workspace.ts` | Clone, branch, commit, push | ☐ |
| `validation-runner.ts` | Lint, typecheck, test subset | ☐ |
| `auto-fix-orchestrator.ts` | Coordinate workflow | 🟡 (Phase 2 partial) |
| `chat-commands.ts` | Parse chat commands | ✅ (in agent router) |
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

## 📅 Milestones (Open Only)

| Milestone | Focus |
|-----------|-------|
| Phase 2 Remainder | Vector similarity & analytics logging |
| Phase 3 Remainder | Real apply + validation + LLM diffs |
| Phase 4 | Full automation (validated PRs) |
| Phase 5 | Metrics, policies, continuous improvement |

---

**Owner:** `@junaidaziz`  
**Feature:** `Automatic AI Code Fix Orchestration`  
**Status:** 🟡 In Progress  
**Next Immediate Task (choose one):** Real LLM wiring OR Validation hardening OR Activity logging OR Regenerate/Cancel commands
