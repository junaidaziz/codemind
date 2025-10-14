# Temporary AI State Limitations

The current AI analysis / fix workflow uses an **in-memory map** (`src/lib/ai-state.ts`) to track:

- `analyzed` flag
- `summary` (simulated AI output)
- `fixPrUrl` (simulated PR link)

## Important Characteristics
- Volatile: Data resets on server restart, deployment, or serverless cold start.
- Not replicated: Each instance maintains its own copy; in multi-region or horizontal scale scenarios results may appear inconsistent.
- Non-auditable: No historical tracking or attribution persisted.

## Why This Exists
Database schema migrations for persistent AI fields (e.g. `aiSummary`, `aiFixAttempt`) are pending. This layer allows the UI to progress and UX flows to be validated without blocking on migrations.

## Migration Plan (Proposed)
1. Add columns to `Issue` model:
   - `aiSummary String?`
   - `aiAnalyzed Boolean @default(false)`
   - `aiFixPrUrl String?`
2. Backfill: None required (all optional).
3. Replace serializers to read directly from Prisma.
4. Remove `ai-state.ts` and related merge logic.
5. Add activity logging (e.g., `ActivityLog` entries for analyze/fix actions).

## Suggested Hardening (If Needed Before Migration)
- Add a lightweight file-based cache (not recommended in serverless) or Redis layer.
- Include a version stamp so stale state can be invalidated after schema deploy.

## Testing
Use `/api/github/resolve` with actions:
```json
{ "issueId": "<id>", "action": "analyze" }
{ "issueId": "<id>", "action": "fix" }
```
Then re-fetch issues: `/api/github/issues?projectId=...` to see updated AI flags.

---
_Last updated: ${new Date().toISOString()}_
