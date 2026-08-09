-- CreateEnum
CREATE TYPE "TravelPhase" AS ENUM ('PREPARES', 'IN_PROGRESS', 'FINISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "TravelPlannedCategory" AS ENUM ('FOOD_DRINKS', 'TRAVEL_EXPENSES', 'HOUSING', 'SOUVENIRS', 'OTHER');

-- CreateEnum
CREATE TYPE "TravelAiReportType" AS ENUM ('OK', 'BAD');

-- CreateTable
CREATE TABLE "Travel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "placeCountry" TEXT,
    "placeCity" TEXT,
    "placeLabel" TEXT,
    "currency" TEXT NOT NULL,
    "maxSpendingGoal" DECIMAL(18,4),
    "phaseOverride" "TravelPhase",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Travel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelPlannedSpending" (
    "id" TEXT NOT NULL,
    "travelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "TravelPlannedCategory" NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelPlannedSpending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelAiReport" (
    "id" TEXT NOT NULL,
    "travelId" TEXT NOT NULL,
    "type" "TravelAiReportType" NOT NULL,
    "reportMessage" TEXT NOT NULL,
    "contextMessage" TEXT,
    "responseLocale" TEXT,
    "extras" JSONB,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelAiReport_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "travelId" TEXT;

-- CreateIndex
CREATE INDEX "Travel_userId_startsAt_idx" ON "Travel"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "Travel_userId_endsAt_idx" ON "Travel"("userId", "endsAt");

-- CreateIndex
CREATE INDEX "TravelPlannedSpending_travelId_category_idx" ON "TravelPlannedSpending"("travelId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "TravelAiReport_travelId_key" ON "TravelAiReport"("travelId");

-- CreateIndex
CREATE INDEX "Transaction_userId_travelId_idx" ON "Transaction"("userId", "travelId");

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelPlannedSpending" ADD CONSTRAINT "TravelPlannedSpending_travelId_fkey" FOREIGN KEY ("travelId") REFERENCES "Travel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelAiReport" ADD CONSTRAINT "TravelAiReport_travelId_fkey" FOREIGN KEY ("travelId") REFERENCES "Travel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_travelId_fkey" FOREIGN KEY ("travelId") REFERENCES "Travel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
