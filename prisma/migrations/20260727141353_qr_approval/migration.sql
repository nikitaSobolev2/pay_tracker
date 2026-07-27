-- CreateEnum
CREATE TYPE "AuthApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CONSUMED');

-- DropIndex
DROP INDEX "Transaction_title_trgm_idx";

-- DropIndex
DROP INDEX "UserCategory_title_trgm_idx";

-- DropIndex
DROP INDEX "UserCounterparty_name_trgm_idx";

-- CreateTable
CREATE TABLE "AuthApproval" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "AuthApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "boundUserId" TEXT,
    "approvedByUserId" TEXT,
    "requesterUserAgent" TEXT,
    "requesterIp" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthApproval_tokenHash_key" ON "AuthApproval"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthApproval_boundUserId_status_expiresAt_idx" ON "AuthApproval"("boundUserId", "status", "expiresAt");
