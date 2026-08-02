-- CreateEnum
CREATE TYPE "EventAiReportType" AS ENUM ('OK', 'BAD');

-- AlterTable
ALTER TABLE "EventCommentThread" ADD COLUMN "createdByAi" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EventComment" ADD COLUMN "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "suggestedAmount" DECIMAL(18,4),
ADD COLUMN "suggestedPrice" DECIMAL(18,4),
ADD COLUMN "amountAppliedAt" TIMESTAMP(3),
ADD COLUMN "priceAppliedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EventAiReport" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "EventAiReportType" NOT NULL,
    "reportMessage" TEXT NOT NULL,
    "contextMessage" TEXT,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAiReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventAiReport_eventId_key" ON "EventAiReport"("eventId");

-- AddForeignKey
ALTER TABLE "EventAiReport" ADD CONSTRAINT "EventAiReport_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
