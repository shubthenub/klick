import redis from "./redis.js";
import prisma from "./prisma.js";

export const invalidatePost = async (postId) => {
    if (!postId) return;
    
    try {
        const postKey = `post:${postId}`;
        await redis.del(postKey);
        console.log(`✅ Cache invalidated for single post: ${postId}`);
    } catch (e) {
        console.error("🔥 Error during single post cache invalidation:", e);
    }
};

/**
 * Invalidates all feed caches for a given user and their followers.
 * @param {string} postAuthorId - The ID of the post's author.
 */
export const invalidateFeeds = async (postAuthorId) => {
    if (!postAuthorId) return;
    
    try {
        // Find the IDs of all users who follow the post's author.
        const followers = await prisma.follow.findMany({
            where: { followingId: postAuthorId },
            select: { followerId: true },
        });
        const followerIds = followers.map(f => String(f.followerId));
        
        // The list of users whose feeds need invalidation includes the author themselves.
        const userIdsToInvalidate = [...followerIds, postAuthorId];
        
        // Invalidate all feed caches for these users using a wildcard pattern.
        for (const userId of userIdsToInvalidate) {
            const feedPattern = `feed:${userId}:*`;
            const feedKeys = await redis.keys(feedPattern);
            if (feedKeys.length > 0) {
                await redis.del(...feedKeys);
                console.log(`✅ Invalidated ${feedKeys.length} feed caches for user ${userId}`);
            }
        }
    } catch (e) {
        console.error("🔥 Error during feed cache invalidation:", e);
    }
};