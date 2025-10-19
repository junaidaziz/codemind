-- CreateTable
CREATE TABLE "AutoFixAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "filesModified" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prompt" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "codeSnippets" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoFixAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoFixValidation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "validationType" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "output" TEXT NOT NULL,
    "errors" TEXT,
    "duration" INTEGER,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoFixValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoFixReview" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "lineNumber" INTEGER,
    "issue" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "suggestion" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postedToGitHub" BOOLEAN NOT NULL DEFAULT false,
    "githubCommentId" INTEGER,
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoFixReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoFixHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "attempts" TEXT NOT NULL,
    "finalStatus" TEXT NOT NULL,
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "validationsPassed" INTEGER NOT NULL DEFAULT 0,
    "validationsFailed" INTEGER NOT NULL DEFAULT 0,
    "reviewFindings" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutoFixHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoFixAttempt_sessionId_idx" ON "AutoFixAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "AutoFixAttempt_sessionId_attemptNumber_idx" ON "AutoFixAttempt"("sessionId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AutoFixValidation_sessionId_idx" ON "AutoFixValidation"("sessionId");

-- CreateIndex
CREATE INDEX "AutoFixValidation_sessionId_validationType_idx" ON "AutoFixValidation"("sessionId", "validationType");

-- CreateIndex
CREATE INDEX "AutoFixValidation_passed_idx" ON "AutoFixValidation"("passed");

-- CreateIndex
CREATE INDEX "AutoFixReview_sessionId_idx" ON "AutoFixReview"("sessionId");

-- CreateIndex
CREATE INDEX "AutoFixReview_sessionId_severity_idx" ON "AutoFixReview"("sessionId", "severity");

-- CreateIndex
CREATE INDEX "AutoFixReview_reviewType_idx" ON "AutoFixReview"("reviewType");

-- CreateIndex
CREATE INDEX "AutoFixReview_postedToGitHub_idx" ON "AutoFixReview"("postedToGitHub");

-- CreateIndex
CREATE UNIQUE INDEX "AutoFixHistory_sessionId_key" ON "AutoFixHistory"("sessionId");

-- CreateIndex
CREATE INDEX "AutoFixHistory_projectId_idx" ON "AutoFixHistory"("projectId");

-- CreateIndex
CREATE INDEX "AutoFixHistory_sessionId_idx" ON "AutoFixHistory"("sessionId");

-- CreateIndex
CREATE INDEX "AutoFixHistory_finalStatus_idx" ON "AutoFixHistory"("finalStatus");

-- CreateIndex
CREATE INDEX "AutoFixHistory_createdAt_idx" ON "AutoFixHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "AutoFixAttempt" ADD CONSTRAINT "AutoFixAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AutoFixSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFixValidation" ADD CONSTRAINT "AutoFixValidation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AutoFixSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoFixReview" ADD CONSTRAINT "AutoFixReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AutoFixSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
