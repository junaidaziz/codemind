-- Migration: add AI persistence fields to Issue
-- Created at 2025-10-15

ALTER TABLE "Issue"
  ADD COLUMN IF NOT EXISTS "aiAnalyzed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "aiFixPrUrl" TEXT;

-- Optional index to query analyzed issues quickly
CREATE INDEX IF NOT EXISTS "Issue_aiAnalyzed_idx" ON "Issue"("aiAnalyzed");
