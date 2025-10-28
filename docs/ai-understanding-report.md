# CodeMind Architecture & AI Understanding Report (Generated 2025-10-28)

## 1. High-Level System Overview
CodeMind is a Next.js (App Router) + Prisma platform that ingests GitHub repositories, chunks source code, (optionally) embeds code chunks, and exposes RAG + automation workflows (PR analysis, AutoFix) through API routes and UI pages. Core domains: Projects, Files/Chunks, AI Usage, AutoFix Sessions/Results, Pull Requests/Issues, Chat Sessions/Messages.

## 2. Data Layer (Prisma Models)
- Project: Root entity tying GitHub URL, indexing status, configs.
- ProjectFile: One record per file in repo; stores path, size, language, git SHA, indexed flag.
- CodeChunk: Line-range segments of files for retrieval; has embedding vector (pgvector) once generated.
- AIModelUsage: Cost + token accounting per model operation.
- AutoFixSession / AutoFixResult: Lifecycle of automated patch attempts.
- PullRequest / Issue / Commit / Contributor: Synced GitHub artifacts.
- ChatSession / Message: Conversation + memory storage for RAG and agent interactions.

## 3. Indexing & Embeddings Flow
Full paths:
1. Full Index Job (`fullIndexProcessor`) → `FullRepositoryIndexer` writes/updates ProjectFile & CodeChunk (embedding disabled inline).
2. Project Index Job (`indexProjectProcessor`) chunks files and immediately calls `embedTexts` then `insertEmbeddingsBatch`.
3. On-demand Embedding Job (`generateEmbeddingsProcessor`) fetches chunk IDs lacking vectors, computes embeddings, writes via raw SQL using pgvector syntax.
Gaps:
- Duplicate logic: Full index path vs. project index embedding behavior divergence.
- Missing guard to avoid re-embedding existing vectors in generateEmbeddingsProcessor.
- No central “embedding backlog” table for incremental scheduling.

## 4. Retrieval & RAG
`langchain-rag.ts` constructs ChatOpenAI + retriever from `CodeMindVectorStore` (abstract) pulling top k (8) chunks. Conversation memory via `CodeMindChatMemory` saves question/answer pairs into Message model. Enhanced tool-based RAG (`generateEnhancedAnswer`) adds domain tools (GitHub, docs, etc.). Token usage currently approximated—needs real counting for cost fairness.

## 5. AutoFix Workflow
Sequence: `startAutoFix` → heuristic keyword/file targeting → stub patch generation (`generatePatchPlan` or LLM variants) → validation simulation → optional PR creation + activity logging. Real LLM patching gated by env flag (`AUTOFIX_LLM_ENABLED`). Safety limits: multi-file patch cap, regeneration limit (3). Gaps: lacks semantic diff risk scoring, test impact analysis, real validation harness.

## 6. GitHub Integration
`GitHubService` syncs PRs, issues, commits, contributors; also branch creation, file commits, PR drafting. PR Analysis job posts structured risk & quality comment (using `githubAPI.analyzePullRequest`). Missing: rate limiting strategy, webhook signature validation clarifications, partial sync diffing.

## 7. AI Model Management & Cost Tracking
`AIModelService` abstracts OpenAI + Anthropic; caches low-temp prompts; records usage rows with token + cost. Future: provider expansion (local, Mistral not yet implemented in chat path), batch aggregation of usage stats for dashboards, anomaly detection (spikes). Token counting for Anthropic/OpenAI is trusted from API; local models need estimator.

## 8. Activity & Observability
ActivityLog captures lifecycle events (index start/complete, AutoFix phases, diff metrics). Improvement: unify structured metadata schema; add severity taxonomy; integrate tracing IDs through jobs & requests; implement retention policy.

## 9. Security & Permissions (RBAC)
Docs outline permission system; code shows TODOs for real role enforcement. Gaps:
- Missing centralized permission middleware in API routes.
- Need auditing for sensitive operations (API key rotation, PR creation).
- Missing rate limiting / abuse protection for chat endpoints.

## 10. Knowledge Graph Summary
See `ai-knowledge-graph.json` for machine-readable nodes and edges. Primary flows:
- Index → Chunk → (Embed) → Retrieve → Answer.
- Issue → AutoFixSession → Patch Stub → (Validate) → (Draft PR).
- User Query → ChatSession & Messages → AIModelService usage metrics.

## 11. Technical Debt & TODO Hotspots
- Embedding disabled path (FullRepositoryIndexer).
- RBAC TODOs (role checks, workspace filtering logic).
- Patch generation stubs (no semantic change analysis / tests).
- Token accounting approximated in RAG; cost may drift.
- Duplicate GitHub webhook routes (webhook vs webhooks) potential consolidation.

## 12. Recommended Improvements (Short-Term)
1. Unify embedding logic: Extract shared EmbeddingManager, detect already embedded chunks.
2. Implement real token accounting (use OpenAI responses + internal counter for retrieval context).
3. Strengthen AutoFix: Add diff risk heuristics (LOC delta, complexity metrics) + allow rejection before PR.
4. RBAC middleware injection: Single function `requirePermission(scope)` used across API route handlers.
5. Rate limiting: Introduce per-user quotas for chat & autofix operations.
6. Observability: Add structured span ID to activity metadata for cross-job tracing.

## 13. Medium-Term Enhancements
- Vector maintenance job to prune stale chunks after file deletions (current deletion logic good, but re-embed after large refactors may require scheduled diff-based validation).
- Semantic patch planning (AST-level edits + test selection).
- Multi-vector strategy (code vs. docs vs. commit messages) with weighted fusion retriever.
- Unified GitHub sync delta detection reducing full list calls.

## 14. Long-Term Vision
Autonomous dev agent performing: context-aware refactors, security patching, dependency upgrade PRs, regression-aware test generation, multi-repo impact analysis. Requires: richer graph (dependencies, call graph), function-level embeddings, real test coverage mapping, pipeline of evaluation metrics.

## 15. Outstanding Gaps Before Calling Agent "Fully Trained"
- Graph doesn’t yet include granular API routes individually (current focus on core services).
- Missing representation for memory tool abstractions (CodeMindVectorStore internals not captured).
- Need validation queries to ensure coverage: e.g., “Where does code chunk embedding happen?”, “How is PR analysis performed?”, etc.

## 16. Validation Queries (Examples)
| Question | Resolution Path |
|----------|-----------------|
| Where are embeddings generated? | `job-processors.ts` generateEmbeddingsProcessor + indexProjectProcessor; FullRepositoryIndexer stub. |
| How are PRs created? | `auto-fix-orchestrator.ts` (applyAutoFix) → `GitHubService.createBranch/commitChanges/createFixPullRequest`. |
| How is chat memory stored? | `langchain-rag.ts` (saveContext) → Message model via prisma.message.create. |
| Where are usage costs tracked? | `ai-model-service.ts` trackUsage → AIModelUsage model. |
| Where does file chunking occur? | `chunkCodeFile` used in FullRepositoryIndexer and job processors. |

## 17. Next Operational Steps
1. Add API route nodes to knowledge graph for full coverage (optional).
2. Implement `scripts/build-embeddings-index.ts` CLI (added separately).
3. Run initial validation script to query graph & assert edge presence.
4. Integrate a lightweight GraphQuery helper into RAG toolset for metadata answers.

---
Generated automatically. Update `generatedAt` timestamps as artifacts evolve.
