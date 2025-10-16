-- Fix missing AI fields in Issue table
-- Run this directly against the database

ALTER TABLE "Issue"
  ADD COLUMN IF NOT EXISTS "aiAnalyzed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "aiFixPrUrl" TEXT;

-- Add index for faster queries on analyzed issues
CREATE INDEX IF NOT EXISTS "Issue_aiAnalyzed_idx" ON "Issue"("aiAnalyzed");
