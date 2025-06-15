-- CreateEnum
CREATE TYPE "SeenType" AS ENUM ('POST', 'MESSAGE', 'NOTIFICATION');

-- CreateTable
CREATE TABLE "Seen" (
    "id" TEXT NOT NULL,
    "type" "SeenType" NOT NULL,
    "seenBy" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seen_id_type_seenBy_key" ON "Seen"("id", "type", "seenBy");
