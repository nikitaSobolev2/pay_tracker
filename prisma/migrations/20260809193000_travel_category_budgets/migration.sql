-- CreateTable
CREATE TABLE "TravelCategoryBudget" (
    "id" TEXT NOT NULL,
    "travelId" TEXT NOT NULL,
    "category" "TravelPlannedCategory" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelCategoryBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelCategoryBudget_travelId_idx" ON "TravelCategoryBudget"("travelId");

-- CreateIndex
CREATE UNIQUE INDEX "TravelCategoryBudget_travelId_category_key" ON "TravelCategoryBudget"("travelId", "category");

-- AddForeignKey
ALTER TABLE "TravelCategoryBudget" ADD CONSTRAINT "TravelCategoryBudget_travelId_fkey" FOREIGN KEY ("travelId") REFERENCES "Travel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
