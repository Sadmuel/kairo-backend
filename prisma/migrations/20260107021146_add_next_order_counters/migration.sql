-- AlterTable
ALTER TABLE "Day" ADD COLUMN     "nextTimeBlockOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill nextTimeBlockOrder for existing Days
UPDATE "Day"
SET "nextTimeBlockOrder" = COALESCE(
  (SELECT MAX("order") + 1 FROM "TimeBlock" WHERE "TimeBlock"."dayId" = "Day"."id"),
  0
);

-- AlterTable
ALTER TABLE "TimeBlock" ADD COLUMN     "nextNoteOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill nextNoteOrder for existing TimeBlocks
UPDATE "TimeBlock"
SET "nextNoteOrder" = COALESCE(
  (SELECT MAX("order") + 1 FROM "Note" WHERE "Note"."timeBlockId" = "TimeBlock"."id"),
  0
);
