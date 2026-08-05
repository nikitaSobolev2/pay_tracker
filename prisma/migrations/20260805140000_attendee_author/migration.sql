-- AlterTable
ALTER TABLE "EventAttendee" ADD COLUMN "authorUserId" TEXT;
ALTER TABLE "EventAttendee" ADD COLUMN "authorGuestId" TEXT;

-- CreateIndex
CREATE INDEX "EventAttendee_authorGuestId_idx" ON "EventAttendee"("authorGuestId");

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_authorGuestId_fkey" FOREIGN KEY ("authorGuestId") REFERENCES "GuestUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
