-- CreateTable
CREATE TABLE "CalculatorBoard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "session" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalculatorBoard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalculatorBoard_userId_updatedAt_idx" ON "CalculatorBoard"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "CalculatorBoard" ADD CONSTRAINT "CalculatorBoard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
