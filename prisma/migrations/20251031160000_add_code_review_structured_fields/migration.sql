-- AlterTable
ALTER TABLE "CodeReview" ADD COLUMN "simulation" JSONB,
ADD COLUMN "documentationSuggestions" JSONB,
ADD COLUMN "testingSuggestions" JSONB;
