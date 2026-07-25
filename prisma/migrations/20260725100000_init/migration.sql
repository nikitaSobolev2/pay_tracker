-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SPENDING', 'EARNING');

-- CreateEnum
CREATE TYPE "TransactionDebtRole" AS ENUM ('LEND', 'BORROW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT NOT NULL,
    "displayUsername" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'RUB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCounterparty" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCounterparty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "inputCurrency" TEXT NOT NULL,
    "originalAmount" DECIMAL(18,4) NOT NULL,
    "rateToRub" DECIMAL(18,8) NOT NULL,
    "fxRateDate" DATE NOT NULL,
    "title" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "debtRole" "TransactionDebtRole",
    "counterpartyId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rateToRub" DECIMAL(18,8) NOT NULL,
    "rateDate" DATE NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'frankfurter',

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionCategory" (
    "transactionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "TransactionCategory_pkey" PRIMARY KEY ("transactionId","categoryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "UserCategory_userId_type_title_idx" ON "UserCategory"("userId", "type", "title");

-- CreateIndex
CREATE UNIQUE INDEX "UserCategory_userId_type_title_key" ON "UserCategory"("userId", "type", "title");

-- CreateIndex
CREATE INDEX "UserCounterparty_userId_name_idx" ON "UserCounterparty"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserCounterparty_userId_name_key" ON "UserCounterparty"("userId", "name");

-- CreateIndex
CREATE INDEX "Transaction_userId_occurredAt_idx" ON "Transaction"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_occurredAt_idx" ON "Transaction"("userId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_debtRole_counterpartyId_idx" ON "Transaction"("userId", "debtRole", "counterpartyId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_idempotencyKey_key" ON "Transaction"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ExchangeRate_rateDate_idx" ON "ExchangeRate"("rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_currency_rateDate_key" ON "ExchangeRate"("currency", "rateDate");

-- CreateIndex
CREATE INDEX "TransactionCategory_categoryId_idx" ON "TransactionCategory"("categoryId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategory" ADD CONSTRAINT "UserCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCounterparty" ADD CONSTRAINT "UserCounterparty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "UserCounterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionCategory" ADD CONSTRAINT "TransactionCategory_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionCategory" ADD CONSTRAINT "TransactionCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "UserCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
