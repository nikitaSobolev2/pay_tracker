-- CreateTable
CREATE TABLE "LoginTransfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoginTransfer_tokenHash_key" ON "LoginTransfer"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginTransfer_userId_expiresAt_idx" ON "LoginTransfer"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "LoginTransfer_codeHash_idx" ON "LoginTransfer"("codeHash");

-- AddForeignKey
ALTER TABLE "LoginTransfer" ADD CONSTRAINT "LoginTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
