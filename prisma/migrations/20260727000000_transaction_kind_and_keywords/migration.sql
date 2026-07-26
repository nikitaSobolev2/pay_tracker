-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('DEFAULT', 'LOAN', 'DEBT', 'REFUND');

-- AlterTable: categories keywords
ALTER TABLE "UserCategory" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: add kind, backfill from debtRole, drop debtRole
ALTER TABLE "Transaction" ADD COLUMN "kind" "TransactionKind" NOT NULL DEFAULT 'DEFAULT';

UPDATE "Transaction"
SET "kind" = CASE
  WHEN "debtRole" = 'LEND' THEN 'LOAN'::"TransactionKind"
  WHEN "debtRole" = 'BORROW' THEN 'DEBT'::"TransactionKind"
  ELSE 'DEFAULT'::"TransactionKind"
END;

DROP INDEX IF EXISTS "Transaction_userId_debtRole_counterpartyId_idx";

ALTER TABLE "Transaction" DROP COLUMN "debtRole";

DROP TYPE "TransactionDebtRole";

CREATE INDEX "Transaction_userId_kind_counterpartyId_idx" ON "Transaction"("userId", "kind", "counterpartyId");
