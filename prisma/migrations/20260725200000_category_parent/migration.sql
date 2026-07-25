-- AlterTable
ALTER TABLE "UserCategory" ADD COLUMN "parentCategoryId" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "UserCategory_userId_type_title_key";

-- CreateIndex
CREATE INDEX "UserCategory_userId_type_parentCategoryId_idx" ON "UserCategory"("userId", "type", "parentCategoryId");

-- CreateIndex
CREATE INDEX "UserCategory_parentCategoryId_idx" ON "UserCategory"("parentCategoryId");

-- AddForeignKey
ALTER TABLE "UserCategory" ADD CONSTRAINT "UserCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "UserCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
