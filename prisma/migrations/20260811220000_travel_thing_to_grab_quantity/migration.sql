-- AlterTable: quantity of items, not money
ALTER TABLE "TravelThingToGrab"
  ALTER COLUMN "amount" TYPE INTEGER
  USING GREATEST(1, ROUND("amount")::integer);
