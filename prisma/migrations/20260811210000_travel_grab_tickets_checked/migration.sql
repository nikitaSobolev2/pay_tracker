-- AlterTable
ALTER TABLE "TravelPlaceToVisit" ADD COLUMN "isChecked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TravelThingToGrab" (
    "id" TEXT NOT NULL,
    "travelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelThingToGrab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelTicket" (
    "id" TEXT NOT NULL,
    "travelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelThingToGrab_travelId_idx" ON "TravelThingToGrab"("travelId");

-- CreateIndex
CREATE INDEX "TravelTicket_travelId_idx" ON "TravelTicket"("travelId");

-- AddForeignKey
ALTER TABLE "TravelThingToGrab" ADD CONSTRAINT "TravelThingToGrab_travelId_fkey" FOREIGN KEY ("travelId") REFERENCES "Travel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelTicket" ADD CONSTRAINT "TravelTicket_travelId_fkey" FOREIGN KEY ("travelId") REFERENCES "Travel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
