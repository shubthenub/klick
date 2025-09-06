import { redisSet ,redisGet} from "@/lib/redisSet";
import prisma from '@/lib/prisma';
// utils/followersCache.js
export const followersCache = {
  getFollowersCacheKey: (userId) => `followers:${userId}`,
  getFollowingCacheKey: (userId) => `following:${userId}`,

  // ✅ Cache followers in EXACT DB format
  warmFollowersCache: async (userId) => {
    try {
      // Fetch data in EXACT same way as getAllFollowersAndFollowingInfo
      const followers = await prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              username: true,
              image_url: true,
            }
          },
        },
      });

      console.log("🔄 Caching followers structure:", {
        count: followers.length,
        sample: followers[0],
        hasNestedFollower: !!followers[0]?.follower
      });

      const cacheKey = followersCache.getFollowersCacheKey(userId);
      await redisSet(cacheKey, followers); // Store exact DB structure
      console.log(`✅ Warmed followers cache for user ${userId} (${followers.length} followers)`);
      return followers;
    } catch (error) {
      console.error(`❌ Failed to warm followers cache for user ${userId}:`, error);
      throw error;
    }
  },

  // ✅ Cache following in EXACT DB format
  warmFollowingCache: async (userId) => {
    try {
      // Fetch data in EXACT same way as getAllFollowersAndFollowingInfo
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              username: true,
              image_url: true,
            }
          },
        },
      });

      console.log("🔄 Caching following structure:", {
        count: following.length,
        sample: following[0],
        hasNestedFollowing: !!following[0]?.following
      });

      const cacheKey = followersCache.getFollowingCacheKey(userId);
      await redisSet(cacheKey, following); // Store exact DB structure
      console.log(`✅ Warmed following cache for user ${userId} (${following.length} following)`);
      return following;
    } catch (error) {
      console.error(`❌ Failed to warm following cache for user ${userId}:`, error);
      throw error;
    }
  },

  invalidateAndWarmBoth: async (userId) => {
    try {
      await Promise.all([
        followersCache.warmFollowersCache(userId),
        followersCache.warmFollowingCache(userId)
      ]);
    } catch (error) {
      console.error(`Failed to invalidate caches for user ${userId}:`, error);
    }
  }
};