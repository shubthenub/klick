/*
  Warnings:

  - You are about to drop the column `email_adress` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "email_adress",
ADD COLUMN     "email_address" TEXT;
