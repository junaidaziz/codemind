-- Add new enum value AI_FIX_DIFF_METRICS to ActivityType
-- PostgreSQL enum alteration
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'AI_FIX_DIFF_METRICS';
