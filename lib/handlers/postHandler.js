// lib/handlers/postHandler.js
import { db } from '../db.js';
import { checkForTrends } from '../../utils/index.js';
import { invalidateFeeds } from '../invalidateCache.js';
import { invalidatePost } from '../invalidateCache.js';
import { redisSet } from '../redisSet.js';
const POST_TTL = 60 * 60; // 1 hour in seconds
import redis from '../redis.js';

export const handleCreatePost = async ({ postText, media = [], userId }) => {
  if (!userId || (!postText?.trim() && media.length === 0)) {
    throw new Error("Post must have text or media.");
  }

  const newPost = await db.Post.create({
    data: {
      postText: postText.trim(),
      media,
      authorId: userId,
    },
  });

  const trends = checkForTrends(postText);
  if (trends?.length > 0) {
    await db.trend.createMany({
      data: trends.map((trend) => ({
        name: trend,
        postId: newPost.id,
      })),
    });
  }


  return newPost;
};

export const handleDeletePost = async ({ postId, userId }) => {
  const post = await db.Post.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== userId) throw new Error("Unauthorized or not found");

  await db.comment.deleteMany({ where: { postId } });
  await db.like.deleteMany({ where: { postId } });
  await db.trend.deleteMany({ where: { postId } });
  await db.Post.delete({ where: { id: postId } });

  // Invalidate the post cache.
  await invalidatePost(postId);


  return { success: true };
};

export const handleUpdatePost = async ({ postId, postText, media }) => {
  invalidatePost(postId); // Invalidate the cache for the post being updated
  return await db.Post.update({
    where: { id: postId },
    data: { postText, media },
  });
};
