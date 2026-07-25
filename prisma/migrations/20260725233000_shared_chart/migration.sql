-- CreateTable
CREATE TABLE "SharedChart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "chartType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedChart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedChart_userId_idx" ON "SharedChart"("userId");

-- CreateIndex
CREATE INDEX "SharedChart_isPublic_idx" ON "SharedChart"("isPublic");

-- AddForeignKey
ALTER TABLE "SharedChart" ADD CONSTRAINT "SharedChart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
