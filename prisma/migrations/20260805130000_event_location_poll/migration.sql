-- CreateEnum
CREATE TYPE "EventPollStatus" AS ENUM ('OPEN', 'FINISHED');

-- CreateEnum
CREATE TYPE "EventPollSelectionMode" AS ENUM ('SINGLE', 'MULTIPLE');

-- AlterTable
ALTER TABLE "EventGuestPresence" ADD COLUMN "attendeeId" TEXT;

-- CreateTable
CREATE TABLE "EventLocationPoll" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "selectionMode" "EventPollSelectionMode" NOT NULL DEFAULT 'SINGLE',
    "endsAt" TIMESTAMP(3),
    "status" "EventPollStatus" NOT NULL DEFAULT 'OPEN',
    "finishedOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventLocationPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLocationPollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "imageUrl" TEXT,
    "authorUserId" TEXT,
    "authorGuestId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLocationPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLocationPollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "voterUserId" TEXT,
    "voterGuestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLocationPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventLocationPoll_finishedOptionId_key" ON "EventLocationPoll"("finishedOptionId");

-- CreateIndex
CREATE INDEX "EventLocationPoll_eventId_status_idx" ON "EventLocationPoll"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventLocationPollOption_pollId_sortOrder_idx" ON "EventLocationPollOption"("pollId", "sortOrder");

-- CreateIndex
CREATE INDEX "EventLocationPollOption_authorGuestId_idx" ON "EventLocationPollOption"("authorGuestId");

-- CreateIndex
CREATE INDEX "EventLocationPollVote_pollId_idx" ON "EventLocationPollVote"("pollId");

-- CreateIndex
CREATE INDEX "EventLocationPollVote_optionId_idx" ON "EventLocationPollVote"("optionId");

-- CreateIndex
CREATE INDEX "EventLocationPollVote_voterGuestId_idx" ON "EventLocationPollVote"("voterGuestId");

-- CreateIndex
CREATE UNIQUE INDEX "EventLocationPollVote_pollId_optionId_voterUserId_key" ON "EventLocationPollVote"("pollId", "optionId", "voterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EventLocationPollVote_pollId_optionId_voterGuestId_key" ON "EventLocationPollVote"("pollId", "optionId", "voterGuestId");

-- CreateIndex
CREATE UNIQUE INDEX "EventGuestPresence_eventId_attendeeId_key" ON "EventGuestPresence"("eventId", "attendeeId");

-- CreateIndex
CREATE INDEX "EventGuestPresence_attendeeId_idx" ON "EventGuestPresence"("attendeeId");

-- AddForeignKey
ALTER TABLE "EventGuestPresence" ADD CONSTRAINT "EventGuestPresence_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "EventAttendee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLocationPoll" ADD CONSTRAINT "EventLocationPoll_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLocationPoll" ADD CONSTRAINT "EventLocationPoll_finishedOptionId_fkey" FOREIGN KEY ("finishedOptionId") REFERENCES "EventLocationPollOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLocationPollOption" ADD CONSTRAINT "EventLocationPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "EventLocationPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLocationPollOption" ADD CONSTRAINT "EventLocationPollOption_authorGuestId_fkey" FOREIGN KEY ("authorGuestId") REFERENCES "GuestUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLocationPollVote" ADD CONSTRAINT "EventLocationPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "EventLocationPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLocationPollVote" ADD CONSTRAINT "EventLocationPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "EventLocationPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLocationPollVote" ADD CONSTRAINT "EventLocationPollVote_voterGuestId_fkey" FOREIGN KEY ("voterGuestId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
