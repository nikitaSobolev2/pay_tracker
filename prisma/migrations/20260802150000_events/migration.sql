-- CreateEnum
CREATE TYPE "EventPublicity" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "EventGuestPermission" AS ENUM ('VIEW', 'EDIT');

-- CreateEnum
CREATE TYPE "EventLinkType" AS ENUM ('LOCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "EventSpendingCategory" AS ENUM ('FOOD', 'DRINKS', 'ALCOHOL', 'HOUSING', 'OTHER');

-- CreateEnum
CREATE TYPE "EventAttendanceStatus" AS ENUM ('CERTAIN', 'UNCERTAIN');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "occursAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "publicity" "EventPublicity" NOT NULL DEFAULT 'PRIVATE',
    "guestPermission" "EventGuestPermission" NOT NULL DEFAULT 'VIEW',
    "currency" TEXT NOT NULL,
    "ownerDisplayName" TEXT,
    "ownerLastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "status" "EventAttendanceStatus" NOT NULL DEFAULT 'CERTAIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLink" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "EventLinkType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSpending" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "EventSpendingCategory" NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(18,4) NOT NULL,
    "amountUnit" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "authorUserId" TEXT,
    "authorGuestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSpending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPayment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCommentThread" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "spendingId" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCommentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventComment" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorGuestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventChatMessage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorGuestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGuestPresence" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventGuestPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_userId_occursAt_idx" ON "Event"("userId", "occursAt");

-- CreateIndex
CREATE INDEX "EventAttendee_counterpartyId_idx" ON "EventAttendee"("counterpartyId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttendee_eventId_counterpartyId_key" ON "EventAttendee"("eventId", "counterpartyId");

-- CreateIndex
CREATE INDEX "EventLink_eventId_type_idx" ON "EventLink"("eventId", "type");

-- CreateIndex
CREATE INDEX "EventSpending_eventId_createdAt_idx" ON "EventSpending"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EventSpending_authorGuestId_idx" ON "EventSpending"("authorGuestId");

-- CreateIndex
CREATE INDEX "EventPayment_eventId_paidAt_idx" ON "EventPayment"("eventId", "paidAt");

-- CreateIndex
CREATE INDEX "EventPayment_attendeeId_idx" ON "EventPayment"("attendeeId");

-- CreateIndex
CREATE INDEX "EventCommentThread_eventId_spendingId_createdAt_idx" ON "EventCommentThread"("eventId", "spendingId", "createdAt");

-- CreateIndex
CREATE INDEX "EventComment_threadId_createdAt_idx" ON "EventComment"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "EventComment_authorGuestId_idx" ON "EventComment"("authorGuestId");

-- CreateIndex
CREATE INDEX "EventChatMessage_eventId_createdAt_idx" ON "EventChatMessage"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EventChatMessage_authorGuestId_idx" ON "EventChatMessage"("authorGuestId");

-- CreateIndex
CREATE INDEX "EventGuestPresence_eventId_lastSeenAt_idx" ON "EventGuestPresence"("eventId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventGuestPresence_eventId_guestUserId_key" ON "EventGuestPresence"("eventId", "guestUserId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "UserCounterparty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLink" ADD CONSTRAINT "EventLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSpending" ADD CONSTRAINT "EventSpending_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSpending" ADD CONSTRAINT "EventSpending_authorGuestId_fkey" FOREIGN KEY ("authorGuestId") REFERENCES "GuestUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPayment" ADD CONSTRAINT "EventPayment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPayment" ADD CONSTRAINT "EventPayment_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "EventAttendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCommentThread" ADD CONSTRAINT "EventCommentThread_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCommentThread" ADD CONSTRAINT "EventCommentThread_spendingId_fkey" FOREIGN KEY ("spendingId") REFERENCES "EventSpending"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EventCommentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_authorGuestId_fkey" FOREIGN KEY ("authorGuestId") REFERENCES "GuestUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChatMessage" ADD CONSTRAINT "EventChatMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChatMessage" ADD CONSTRAINT "EventChatMessage_authorGuestId_fkey" FOREIGN KEY ("authorGuestId") REFERENCES "GuestUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGuestPresence" ADD CONSTRAINT "EventGuestPresence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGuestPresence" ADD CONSTRAINT "EventGuestPresence_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
