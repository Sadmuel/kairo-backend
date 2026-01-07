/*
  Warnings:

  - A unique constraint covering the columns `[timeBlockId,order]` on the table `Note` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dayId,order]` on the table `TimeBlock` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Note_timeBlockId_order_key" ON "Note"("timeBlockId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TimeBlock_dayId_order_key" ON "TimeBlock"("dayId", "order");
