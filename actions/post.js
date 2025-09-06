"use server";

import { db } from "@/lib/db";
import { checkForTrends } from "@/utils";
import { auth} from "@clerk/nextjs/server";
import { getAllFollowersAndFollowingInfo , getFollowersAndFollowingIds } from "./user";
import  prisma  from "@/lib/prisma";
import redis from "@/lib/redis";
import { redisSet, redisGet } from "@/lib/redisSet";
import { invalidateFeeds } from "@/lib/invalidateCache";

const LikeType = {
  POST: "POST",
  COMMENT: "COMMENT",
  MESSAGE: "MESSAGE",
};

// export const createPost = async (post) => {    //for multiple media uploads we used alternative route (post) , hence commented this code
//   try {
//     if (!post || typeof post !== "object") {
//       throw new Error("Invalid post payload");
//     }
//     console.log("💡 typeof post:", typeof post);
//     console.log("💡 post value:", post);
    

//     const { postText = "", media = [], userId } = post;

//     if (!userId) throw new Error("User not authenticated");

//     const userExists = await prisma.User.findUnique({ where: { id: userId } });
//     if (!userExists) throw new Error("User not found");

//     if (!postText.trim() && media.length === 0) {
//       throw new Error("Post cannot be empty");
//     }

//     const newPost = await prisma.Post.create({
//       data: {
//         postText: postText.trim(),
//         media,
//         authorId: userId,
//       },
//     });

//     const trends = checkForTrends(postText);
//     if (trends?.length > 0) {
//       await createTrends(trends, newPost.id);
//     }

//     return { data: newPost, success: true };
//   } catch (error) {
//     console.error("🔥 Post Creation Error:", error);
//     throw new Error(error.message || "Something went wrong");
//   }
// };






export const deletePost = async (postId, userId) => {
    try {
        // Verify post exists and belongs to the user
        const post = await prisma.Post.findUnique({
            where: { id: postId },
        });

        if (!post) {
            throw new Error("Post not found");
        }

        if (post.authorId !== userId) {
            throw new Error("Unauthorized to delete this post");
        }

        // Delete associated comments, likes, and trends first (if foreign key constraint)
        await prisma.comment.deleteMany({ where: { postId } });
        await prisma.like.deleteMany({ where: { postId } });
        await prisma.trend.deleteMany({ where: { postId } });

        // Then delete the post
        await prisma.Post.delete({ where: { id: postId } });
        invalidateFeeds(userId);

        return { success: true };
    } catch (error) {
        console.error("Error deleting post:", error);
        throw error;
    }
};

// actions/post.js

// In your /actions/getFeed.js file

// ... (existing imports) ...

// Remove the db import and use prisma consistently


export const getFeed = async (lastCursor, id, take = 5) => {
    const userId = id || await auth()?.userId;
    if (!userId) throw new Error('User ID is missing');

    console.log('🔍 getFeed called with:', {
        lastCursor,
        lastCursorType: typeof lastCursor,
        lastCursorLength: lastCursor?.length,
        isEmpty: lastCursor === '',
        id,
        take,
        userId
    });

    // Get following IDs first (needed for both cache and DB queries)
    const following = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
    });
    const followingIds = following.map((user) => user.followingId);
    const allIds = [...new Set([...followingIds, userId])];

    console.log('👥 Following IDs count:', allIds.length);

    // Check cache for first page only (no cursor or empty string) to avoid ordering issues
    if (!lastCursor || lastCursor === '') {
        const feedKey = `feed:${userId}:first:${take}`;
        let cachedFeedResult = await redisGet(feedKey);
        console.log('🏠 Cache check details:', {
            feedKey,
            cachedFeedResult: cachedFeedResult,
            hasResult: !!cachedFeedResult,
            type: typeof cachedFeedResult
        });

        // Check if we have a complete cached feed result (with metadata)
        if (cachedFeedResult && cachedFeedResult.postIds && Array.isArray(cachedFeedResult.postIds) && cachedFeedResult.postIds.length > 0) {
            console.log('✅ Using cached feed result:', {
                postIds: cachedFeedResult.postIds.length,
                hasMore: cachedFeedResult.hasMore,
                cursor: cachedFeedResult.cursor
            });
            
            // Fetch full post data for these IDs from individual post cache
            const cachedPostsData = await redis.mget(...cachedFeedResult.postIds.map(id => `post:${id}`));
            const posts = [];
            const missingPostIds = [];

            // Rebuild feed from cache and identify missing posts
            for (let i = 0; i < cachedFeedResult.postIds.length; i++) {
                const postId = cachedFeedResult.postIds[i];
                const cachedData = cachedPostsData[i];

                if (cachedData) {
                    try {
                        posts.push(JSON.parse(cachedData));
                    } catch (e) {
                        console.error('Error parsing cached post:', e);
                        missingPostIds.push(postId);
                    }
                } else {
                    missingPostIds.push(postId);
                }
            }

            // Fetch missing posts from database if any
            if (missingPostIds.length > 0) {
                console.log('🔄 Fetching missing posts from DB:', missingPostIds.length);
                const dbPosts = await prisma.post.findMany({
                    where: { id: { in: missingPostIds } },
                    include: {
                        author: true,
                        likes: true,
                        comments: {
                            where: { parentId: null },
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            include: {
                                author: true,
                                _count: { select: { replies: true, Like: true } },
                            },
                        },
                        _count: { select: { comments: true } },
                    },
                });

                // Merge missing posts back into the correct positions
                const missingPostsMap = new Map(dbPosts.map(p => [p.id, p]));
                for (let i = 0; i < cachedFeedResult.postIds.length; i++) {
                    const postId = cachedFeedResult.postIds[i];
                    if (missingPostIds.includes(postId) && missingPostsMap.has(postId)) {
                        posts.splice(i, 0, missingPostsMap.get(postId));
                    }
                }

                // Cache the newly fetched posts
                await Promise.all(
                    dbPosts.map(p => redisSet(`post:${p.id}`, JSON.stringify(p), 6000))
                );
            }

            // Use cached pagination metadata
            const actualPosts = posts.slice(0, take);
            
            console.log('📊 Cached path debug:', {
                totalCachedPosts: posts.length,
                actualPostsReturned: actualPosts.length,
                requestedTake: take,
                cachedHasMore: cachedFeedResult.hasMore,
                cachedCursor: cachedFeedResult.cursor
            });
            
            return {
                data: actualPosts,
                metadata: {
                    lastCursor: cachedFeedResult.cursor,
                    hasMore: cachedFeedResult.hasMore
                }
            };
        }
    }

    // Cache miss or pagination - fetch from database
    console.log('❌ Cache miss or pagination, fetching from DB');
    
    const posts = await prisma.post.findMany({
        include: {
            author: true,
            likes: true,
            comments: {
                where: { parentId: null },
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: {
                    author: true,
                    _count: { select: { replies: true, Like: true } },
                },
            },
            _count: { select: { comments: true } },
        },
        where: { authorId: { in: allIds } },
        take: take + 1, // Fetch one extra to check for more pages
        ...(lastCursor && lastCursor !== '' && { skip: 1, cursor: { id: lastCursor } }),
        orderBy: { createdAt: "desc" }
    });

    console.log('📊 Posts fetched from DB:', posts.length);

    // Determine pagination
    const hasMore = posts.length > take;
    const actualPosts = hasMore ? posts.slice(0, take) : posts;
    const lastPost = actualPosts.length > 0 ? actualPosts[actualPosts.length - 1] : null;
    const cursor = lastPost ? lastPost.id : null;

    // If we got exactly 'take' posts and no extra, we need to check if there are more
    let finalHasMore = hasMore;
    if (!hasMore && actualPosts.length === take && lastPost) {
        console.log('🔍 Checking for additional posts beyond current page...');
        const additionalPostsCount = await prisma.post.count({
            where: { 
                authorId: { in: allIds },
                createdAt: { lt: lastPost.createdAt }
            },
            take: 1
        });
        finalHasMore = additionalPostsCount > 0;
        console.log('🔍 Additional posts found:', additionalPostsCount, 'finalHasMore:', finalHasMore);
    }

    console.log('🚀 Pagination debug:', {
        totalFetched: posts.length,
        requestedTake: take,
        hasMore: hasMore,
        finalHasMore: finalHasMore,
        actualPostsCount: actualPosts.length,
        cursor: cursor,
        lastPostId: lastPost?.id,
        lastPostDate: lastPost?.createdAt
    });

    // Cache first page results with metadata
    if (!lastCursor && actualPosts.length > 0) {
        const feedKey = `feed:${userId}:first:${take}`;
        const postIds = actualPosts.map(p => p.id);
        
        // Store complete feed result with pagination metadata
        const feedResult = {
            postIds: postIds,
            cursor: cursor,
            hasMore: finalHasMore,
            timestamp: Date.now()
        };
        
        await redisSet(feedKey, feedResult, 6000);
        
        // Cache individual posts
        await Promise.all(
            actualPosts.map(p => redisSet(`post:${p.id}`, JSON.stringify(p), 6000))
        );
        console.log('💾 Cached first page results with metadata:', {
            postIds: postIds.length,
            hasMore: finalHasMore,
            cursor: cursor
        });
    }
    
    console.log('📊 Final posts count:', actualPosts.length);
    console.log('📊 Has more:', hasMore);
    console.log('📊 Final has more:', finalHasMore);
    console.log('📊 Cursor:', cursor);
    
    return {
        data: actualPosts,
        metadata: {
            lastCursor: cursor,
            hasMore: finalHasMore
        }
    };
};

//function to get feed of ur own 
export const getMyPosts = async (lastCursor, id, take = 10) => {
  const cacheKey = `self:${id}:${lastCursor || "first"}:${take}`;
  const cached = await redisGet(cacheKey);
  if (cached) return cached;

  const where = id !== "all" ? { author: { id } } : {};
  const posts = await prisma.post.findMany({
    include: {
      author: true,
      likes: true,
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          author: true,
          _count: { select: { replies: true, Like: true } },
        },
      },
      _count: {
        select: { comments: true } // <-- add this
      },
    },
    where,
    take,
    ...(lastCursor && { skip: 1, cursor: { id: lastCursor } }),
    orderBy: { createdAt: "desc" }
  });

  if (posts.length === 0) {
    const result = {
      data: [],
      metaData: {
        lastCursor: null,
        hasMore: false,
      },
    };
    await redisSet(cacheKey, result, 6000);
    return result;
  }
  const lastPostInResults = posts[posts.length - 1];
  const cursor = lastPostInResults?.id;

  const morePosts = await prisma.post.findMany({
    where,
    take,
    skip: 1,
    cursor: { id: cursor },
  });
  const result = {
    data: posts,
    metaData: {
      lastCursor: cursor,
      hasMore: morePosts.length > 0,
    },
  };
  await redisSet(cacheKey, result, 6000);
  return result;
};



export const updatePostLike = async (postId, actionType, userId) => {
    console.log("Updating post like with:", { postId, actionType, userId });

    if (!postId || !userId || !actionType) {
        console.error("Invalid input data:", { postId, actionType, userId });
        throw new Error("Missing required fields");
    }

    try {
        const post = await prisma.Post.findUnique({
            where: { id: postId },
            include: { likes: true },
        });

        if (!post) {
            console.error("Post not found");
            return { error: "Post not found" };
        }

        const existingLike = post.likes.find((like) => like.authorId === userId);

        if (actionType === "like" && !existingLike) {
            await prisma.Like.create({
                data: {
                    post: { connect: { id: postId } },
                    author: { connect: { id: userId } },
                },
            });
            console.log("✅ Like added successfully");
        } else if (actionType === "unlike" && existingLike) {
            await prisma.Like.deleteMany({
                where: { postId, authorId: userId },
            });
            console.log("✅ Like removed successfully");
        }

        return { success: true };

    } catch (e) {
        console.error("🔥 Error updating post like:", e);
        throw e;
    }
};

export const addComment = async (postId, comment, userId, parentId = null) => {
  try {
    const newComment = await prisma.Comment.create({
      data: {
        comment,
        post: { connect: { id: postId } },
        author: { connect: { id: userId } },
        ...(parentId && {
          parent: { connect: { id: parentId } }
        }),
      },
      include: {
        author: true,
        parent: {
          include: {
            author: true,
          },
        },
      },
    });

    return { data: newComment };
  } catch (e) {
    console.error("🔥 Error creating comment:", e);
    throw new Error(e.message || "Failed to create comment");
  }
};



export const createTrends = async (trends, postId) => {
    try {
        if (!Array.isArray(trends) || trends.length === 0) {
            throw new Error("Invalid trends array");
        }
        if (!postId) throw new Error("Invalid postId");

        const newTrends = await prisma.trend.createMany({
            data: trends.map((trend) => ({
                name: trend,  // Use `name` instead of `trend`
                postId: postId,
            })),
        });

        console.log("Trends created successfully:", newTrends);
        return { data: newTrends };
    } catch (e) {
        console.error("Error creating trends:", e);
        throw e;
    }
};

//function to retreivw popular trends 
export const getPopularTrends = async () => {
    try {
        const trends = await prisma.trend.groupBy({
            by: ["name"],
            _count: {
                name: true,
            },
            orderBy: {
                _count: {
                    name: "desc",
                },
            },
            take: 3,
        })
        return {
            data: trends,
        }
    } catch (e) {
        console.error("Error fetching popular trends:", e);
        throw e;
    }
};




export const updateLike = async ({ targetId, userId, type, action }) => {
  if (!targetId || !userId || !action || typeof type !== "string") {
    console.error("🚨 Invalid like input:", { targetId, userId, type, action });
    throw new Error("Missing or invalid fields in updateLike");
  }

  const enumType = LikeType[type.toUpperCase()];
  if (!enumType) {
    throw new Error(`Invalid LikeType: ${type}`);
  }

  const data = {
    author: { connect: { id: userId } },
    type: enumType,
    createdAt: new Date(),
  };

  if (enumType === LikeType.POST) data.post = { connect: { id: Number(targetId) } };
  if (enumType === LikeType.COMMENT) data.comment = { connect: { id: Number(targetId) } };
  if (enumType === LikeType.MESSAGE) data.message = { connect: { id: targetId } };

  try {
    if (action === "like") {
      await prisma.like.create({ data });
      return { success: true };
    }

    const whereClause = {
      authorId: userId,
      type: enumType,
    };

    if (enumType === LikeType.POST) whereClause.postId = Number(targetId);
    if (enumType === LikeType.COMMENT) whereClause.commentId = Number(targetId);
    if (enumType === LikeType.MESSAGE) whereClause.messageId = targetId;

    if (action === "unlike") {
      await prisma.like.deleteMany({ where: whereClause });
      return { success: true };
    }

    throw new Error("Invalid action");
  } catch (err) {
    console.error("🔥 Like error:", err);
    throw err;
  }
};



