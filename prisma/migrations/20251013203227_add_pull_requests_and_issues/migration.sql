-- CreateEnum
CREATE TYPE "PullRequestState" AS ENUM ('OPEN', 'CLOSED', 'MERGED');

-- CreateEnum
CREATE TYPE "IssueState" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "github_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "state" "PullRequestState" NOT NULL DEFAULT 'OPEN',
    "html_url" TEXT NOT NULL,
    "diff_url" TEXT NOT NULL,
    "patch_url" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "author_avatar" TEXT,
    "base_branch" TEXT NOT NULL,
    "head_branch" TEXT NOT NULL,
    "mergeable" BOOLEAN,
    "merged" BOOLEAN NOT NULL DEFAULT false,
    "merged_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "ai_analyzed" BOOLEAN NOT NULL DEFAULT false,
    "ai_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "github_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "state" "IssueState" NOT NULL DEFAULT 'OPEN',
    "html_url" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "author_avatar" TEXT,
    "labels" JSONB NOT NULL DEFAULT '[]',
    "assignees" JSONB NOT NULL DEFAULT '[]',
    "closed_at" TIMESTAMP(3),
    "ai_analyzed" BOOLEAN NOT NULL DEFAULT false,
    "ai_summary" TEXT,
    "ai_fix_attempt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pull_requests_github_id_key" ON "pull_requests"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "issues_github_id_key" ON "issues"("github_id");

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;