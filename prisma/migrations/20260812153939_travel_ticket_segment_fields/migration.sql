-- AlterTable
ALTER TABLE "TravelTicket" ADD COLUMN     "arrivesAt" TIMESTAMP(3),
ADD COLUMN     "bookingCode" TEXT,
ADD COLUMN     "departsAt" TIMESTAMP(3),
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "flightNumber" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "ticketNumber" TEXT;
