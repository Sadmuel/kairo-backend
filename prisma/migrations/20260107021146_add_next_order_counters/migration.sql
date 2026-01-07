-- AlterTable
ALTER TABLE "Day" ADD COLUMN     "nextTimeBlockOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TimeBlock" ADD COLUMN     "nextNoteOrder" INTEGER NOT NULL DEFAULT 0;
