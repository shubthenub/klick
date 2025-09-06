/*
  Warnings:

  - A unique constraint covering the columns `[authorId,postId,commentId,messageId,type]` on the table `Like` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LikeType" AS ENUM ('POST', 'COMMENT', 'MESSAGE');

-- AlterTable
ALTER TABLE "Like" ADD COLUMN     "commentId" INTEGER,
ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "type" "LikeType" NOT NULL DEFAULT 'POST',
ALTER COLUMN "postId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Like_authorId_postId_commentId_messageId_type_key" ON "Like"("authorId", "postId", "commentId", "messageId", "type");

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
