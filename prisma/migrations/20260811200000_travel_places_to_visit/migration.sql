-- CreateTable
CREATE TABLE "TravelPlaceToVisit" (
    "id" TEXT NOT NULL,
    "travelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelPlaceToVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelPlaceToVisit_travelId_idx" ON "TravelPlaceToVisit"("travelId");

-- AddForeignKey
ALTER TABLE "TravelPlaceToVisit" ADD CONSTRAINT "TravelPlaceToVisit_travelId_fkey" FOREIGN KEY ("travelId") REFERENCES "Travel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
