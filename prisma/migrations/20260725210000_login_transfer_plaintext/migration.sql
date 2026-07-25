-- AlterTable
ALTER TABLE "LoginTransfer" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "LoginTransfer" ADD COLUMN IF NOT EXISTS "token" TEXT;

-- Existing rows cannot be redisplayed; expire them so a fresh transfer is issued.
UPDATE "LoginTransfer"
SET "expiresAt" = CURRENT_TIMESTAMP
WHERE "code" IS NULL OR "token" IS NULL OR "code" = '' OR "token" = '';

UPDATE "LoginTransfer" SET "code" = coalesce("code", '') WHERE "code" IS NULL;
UPDATE "LoginTransfer" SET "token" = coalesce("token", '') WHERE "token" IS NULL;

ALTER TABLE "LoginTransfer" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "LoginTransfer" ALTER COLUMN "token" SET NOT NULL;
