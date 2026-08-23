-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "sourceTransactionId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_sourceTransactionId_idx" ON "Transaction"("sourceTransactionId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sourceTransactionId_fkey" FOREIGN KEY ("sourceTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
