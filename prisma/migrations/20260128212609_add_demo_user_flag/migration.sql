-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RecurrenceType" ADD VALUE 'WEEKDAYS';
ALTER TYPE "RecurrenceType" ADD VALUE 'WEEKENDS';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDemoUser" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_isDemoUser_createdAt_idx" ON "User"("isDemoUser", "createdAt");
