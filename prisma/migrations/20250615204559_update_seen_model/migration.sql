/*
  Warnings:

  - The primary key for the `Seen` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The required column `seenId` was added to the `Seen` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Seen" DROP CONSTRAINT "Seen_pkey",
ADD COLUMN     "seenId" TEXT NOT NULL,
ADD CONSTRAINT "Seen_pkey" PRIMARY KEY ("seenId");
