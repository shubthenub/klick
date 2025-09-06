// lib/handlers/likeHandler.js
import { db } from '../db.js';

export const handleLike = async ({ targetId, userId, type }) => {
  return await db.Like.create({
    data: {
      author: { connect: { id: userId } },
      type,
      createdAt: new Date(),
      ...(type === "POST" && { post: { connect: { id: Number(targetId) } } }),
      ...(type === "COMMENT" && { comment: { connect: { id: Number(targetId) } } }),
      ...(type === "MESSAGE" && { message: { connect: { id: targetId } } }),
    },
  });
};

export const handleUnlike = async ({ targetId, userId, type }) => {
  const where = { authorId: userId, type };
  if (type === "POST") where.postId = Number(targetId);
  if (type === "COMMENT") where.commentId = Number(targetId);
  if (type === "MESSAGE") where.messageId = targetId;

  return await db.Like.deleteMany({ where });
};
