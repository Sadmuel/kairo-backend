-- AlterTable
ALTER TABLE "TimeBlock" ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "TimeBlockTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT,
    "daysOfWeek" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activeUntil" DATE,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeBlockTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterializationExclusion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterializationExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeBlockTemplate_userId_isActive_idx" ON "TimeBlockTemplate"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateNote_templateId_order_key" ON "TemplateNote"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MaterializationExclusion_templateId_date_key" ON "MaterializationExclusion"("templateId", "date");

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TimeBlockTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlockTemplate" ADD CONSTRAINT "TimeBlockTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateNote" ADD CONSTRAINT "TemplateNote_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TimeBlockTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterializationExclusion" ADD CONSTRAINT "MaterializationExclusion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TimeBlockTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
