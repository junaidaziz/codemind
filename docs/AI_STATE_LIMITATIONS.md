# AI State (Legacy Temporary Layer) – Deprecated

This document previously described a temporary **in-memory AI issue state** layer (`src/lib/ai-state.ts`). That layer has now been fully **removed** and replaced by persistent fields on the `Issue` model.

## Current Implementation (Persistent)
AI related metadata is stored directly in Postgres via Prisma:

- `aiAnalyzed  Boolean @default(false)`
- `aiAnalyzedAt DateTime?`
- `aiSummary   String?`
- `aiFixPrUrl  String?` (also surfaced to the frontend as `aiFixAttempt` for backward compatibility)

All reads now come from the database (see `GET /api/github/issues`). All writes occur in `POST /api/github/resolve` (actions: `analyze`, `fix`).

## Removed Temporary Module
`src/lib/ai-state.ts` has been deleted. There is no longer any volatile per-process memory map for AI issue state.

## Backward Compatibility
The frontend previously expected `aiFixAttempt`. The API layer maps `aiFixPrUrl` -> `aiFixAttempt` until the UI is updated to use the new canonical field name.

## Future Enhancements
1. Activity logging (`ActivityLog`) entries for analyze/fix actions.
2. Optional PR creation logic using authenticated GitHub token instead of placeholder URLs.
3. Metrics roll‑up into `DeveloperInsights` (e.g., increment `totalAiFixes`).
4. Validation to prevent duplicate analyze/fix operations within a short cooldown window.

## Testing the Flow
1. Analyze:
   POST `/api/github/resolve` `{ "issueId": "<id>", "action": "analyze" }`
2. Fix (simulated PR link):
   POST `/api/github/resolve` `{ "issueId": "<id>", "action": "fix" }`
3. List:
   GET `/api/github/issues?projectId=<projectId>` → observe updated AI fields.

## Migration Summary
- Added DB columns via migration `20251015000000_add_issue_ai_fields`.
- Regenerated Prisma client.
- Refactored routes to persist and serve new fields.
- Removed legacy in-memory module.

## Status
This document is retained for historical context and will be removed or merged into general architecture docs later.

---
Last updated (manual stamp): 2025-10-15
