-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Transaction_userId_isDeleted_occurredAt_idx" ON "Transaction"("userId", "isDeleted", "occurredAt");
