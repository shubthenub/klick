import { db } from '../db.js';
import redis from '../redis.js';
import { redisGet , redisSet} from '../redisSet.js';
export const handleAddComment = async ({ postId, comment, userId, parentId = null }) => {
  if (postId) {
      const postKey = `post:${postId}`;
      await redis.del(postKey);
      console.log(`✅ Cache invalidated for post: ${postId}`);
  }
  const newComment = await db.Comment.create({
    data: {
      comment,
      post: { connect: { id: postId } },
      author: { connect: { id: userId } },
      ...(parentId && {
        parent: { connect: { id: parentId } },
      }),
    },
    include: {
      author: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          image_url: true,
        },
      },
      post: {
        select: {
          id: true,
          media: true,
          author: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      parent: {
        select: {
          id: true,
          author: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  return {
    id: newComment.id,
    comment: newComment.comment,
    postId: newComment.post.id,
    postAuthorId: newComment.post.author.id,
    postAuthorUsername: newComment.post.author.username,
    commentAuthorId: newComment.author.id,
    commentAuthor: newComment.author,
    postMedia: newComment.post.media,
    parentAuthorId: newComment.parent?.author?.id || null,
    hasParent: !!newComment.parent,
  };
};

export const handleDeleteComment = async ({ commentId, userId }) => {
  const comment = await db.Comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.authorId !== userId) {
    throw new Error("Unauthorized or not found");
  }

  if (comment.postId) {
      const postKey = `post:${comment.postId}`;
      await redis.del(postKey);
      console.log(`✅ Cache invalidated for post: ${comment.postId}`);
  }

  await db.Comment.delete({ where: { id: commentId } });
  // Delete notifications related to this comment
  await db.Notification.deleteMany({ where: { commentId } });
  return { success: true };
};
