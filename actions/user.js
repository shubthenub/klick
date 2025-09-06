'use server'
import {db} from "@/lib/db";
import { deleteFile, uploadFile } from "./uploadFile";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { redisGet, redisSet } from '@/lib/redisSet';
import { followersCache } from '@/utils/followersCache';

export const createUser = async (user) => {
    const { id, first_name, last_name, email_address, image_url, username } = user;

    try {
        // Log user data to verify what is being passed
        console.log("Attempting to create user with data:", user);

        // Check if the user already exists by unique id or email
        const userExist = await db.user.findUnique({
            where: { email_address: email_address }, // Assuming email_address should be unique
        });

        if (userExist) {
            //update user function
            updateUser(user);
            console.log("User already exists:", userExist);
            return; // Skip creating the user if they already exist
        }

        // Create a new user if they do not exist
        const newUser = await db.user.create({
            data: {
                id,
                first_name,
                last_name,
                email_address: email_address, // Correct field name in the schema
                image_url,
                username,
            },
        });

        console.log("User successfully created:", newUser);
    } catch (error) {
        console.error("Error creating user in db:", error.message);
        throw new Error("Error creating user in db");
    }
};

export const updateUser = async (user) => {
    try {
        db.user.update({
            where: { id: user.id },
            data: {
                first_name: user.first_name,
                last_name: user.last_name,
                email_address: user.email_address,
                image_url: user.image_url,
                username: user.username,
            },
        });
        console.log("User successfully updated");
    } catch (e) {
        console.log(e);
        return;
    }
}

export async function deleteUser(userId) {
    const { error } = await supabase
        .from("users") // Adjust the table name if different
        .delete()
        .eq("id", userId);

    if (error) {
        console.error("Error deleting user from Supabase:", error);
        throw error;
    }
}

export const getUser = async (id) => {
    try {
        const user = await db.user.findUnique({
            where: { id: id },
            select:{
                id: true,
                first_name: true,
                last_name: true,
                email_address: true,
                image_url: true,
                username: true,
                banner_url: true,
                banner_id: true,
            }
        });
        console.log("User found:", user);
        return {data : user};
    } catch (e) {
        console.log("failed to get the user form db" , e).message;
        return;
    }
}

export const updateBanner = async (params) => {
    try {
        const { id, banner, prevBannerId } = params;
        console.log("Params received:", params);

        if (!id) {
            console.error("User ID is required to update banner");
            return;
        }

        let banner_id, banner_url;

        if (banner) {
            const res = await uploadFile(banner, `/users/${id}`);
            
            // Fix: Access response directly (no `data` key)
            if (!res?.public_id || !res?.secure_url) {
                console.error("Upload failed or returned an unexpected response:", res);
                return;
            }

            banner_id = res.public_id;
            banner_url = res.secure_url;

            console.log("File uploaded successfully:", { banner_id, banner_url });

            // Delete previous banner if exists
            if (prevBannerId) {
                try {
                    await deleteFile(prevBannerId);
                    console.log(`Previous banner (${prevBannerId}) deleted successfully.`);
                } catch (deleteError) {
                    console.warn("Failed to delete previous banner:", deleteError);
                }
            }

            // Update user record in DB
            await db.user.update({
                where: { id },
                data: { banner_id, banner_url },
            });

            console.log("User banner updated successfully.");
        }
    } catch (e) {
        console.error("Error updating user banner:", e);
    }
};

// For feed and follow button - IDs only (fast)
export const getFollowersAndFollowingIds = async (id) => {
    try {
        const [followers, following] = await Promise.all([
            prisma.follow.findMany({
                where: { followingId: id },
                select: { followerId: true },
            }),
            prisma.follow.findMany({
                where: { followerId: id },
                select: { followingId: true },
            })
        ]);

        return { 
            followers: followers.map(f => ({ followerId: f.followerId })),
            following: following.map(f => ({ followingId: f.followingId }))
        };
    } catch (error) {
        console.error("Error fetching followers and following IDs:", error);
        throw error;
    }
};

// For profile pages - full user data (slower but needed)
// Temporary bypass - comment out the cache check


export const getAllFollowersAndFollowingInfo = async (
  id,
  { cursor = 0, limit = 15, followers = true, following = true } = {}
) => {
  try {
    const result = {
      followers: [],
      following: [],
      nextCursorFollowers: null,
      nextCursorFollowing: null,
    };

    // =========================
    // ✅ Followers (lazy + cache first page)
    // =========================
    if (followers) {
      if (cursor === 0) {
        const followersCacheKey = `followers:${id}:first:${limit}`;
        const cachedFollowers = await redisGet(followersCacheKey);

        if (cachedFollowers) {
          console.log(`🎯 Cache hit for followers of user ${id} (first page)`);
          result.followers = cachedFollowers.data;
          result.nextCursorFollowers = cachedFollowers.nextCursor;
        } else {
          console.log(`💾 Cache miss for followers of user ${id} (first page)`);
          const followersFromDb = await prisma.follow.findMany({
            where: { followingId: id },
            take: limit + 1,
            orderBy: { createdAt: "desc" },
            include: {
              follower: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  username: true,
                  image_url: true,
                },
              },
            },
          });

          let nextCursorFollowers = null;
          if (followersFromDb.length > limit) {
            nextCursorFollowers = limit;
            followersFromDb.pop();
          }

          result.followers = followersFromDb;
          result.nextCursorFollowers = nextCursorFollowers;

          await redisSet(
            followersCacheKey,
            { data: followersFromDb, nextCursor: nextCursorFollowers },
            600
          );
        }
      } else {
        const followersFromDb = await prisma.follow.findMany({
          where: { followingId: id },
          skip: cursor,
          take: limit + 1,
          orderBy: { createdAt: "desc" },
          include: {
            follower: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                username: true,
                image_url: true,
              },
            },
          },
        });

        let nextCursorFollowers = null;
        if (followersFromDb.length > limit) {
          nextCursorFollowers = cursor + limit;
          followersFromDb.pop();
        }

        result.followers = followersFromDb;
        result.nextCursorFollowers = nextCursorFollowers;
      }
    }

    // =========================
    // ✅ Following (lazy + cache first page)
    // =========================
    if (following) {
      if (cursor === 0) {
        const followingCacheKey = `following:${id}:first:${limit}`;
        const cachedFollowing = await redisGet(followingCacheKey);

        if (cachedFollowing) {
          console.log(`🎯 Cache hit for following of user ${id} (first page)`);
          result.following = cachedFollowing.data;
          result.nextCursorFollowing = cachedFollowing.nextCursor;
        } else {
          console.log(`💾 Cache miss for following of user ${id} (first page)`);
          const followingFromDb = await prisma.follow.findMany({
            where: { followerId: id },
            take: limit + 1,
            orderBy: { createdAt: "desc" },
            include: {
              following: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  username: true,
                  image_url: true,
                },
              },
            },
          });

          let nextCursorFollowing = null;
          if (followingFromDb.length > limit) {
            nextCursorFollowing = limit;
            followingFromDb.pop();
          }

          result.following = followingFromDb;
          result.nextCursorFollowing = nextCursorFollowing;

          await redisSet(
            followingCacheKey,
            { data: followingFromDb, nextCursor: nextCursorFollowing },
            600
          );
        }
      } else {
        const followingFromDb = await prisma.follow.findMany({
          where: { followerId: id },
          skip: cursor,
          take: limit + 1,
          orderBy: { createdAt: "desc" },
          include: {
            following: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                username: true,
                image_url: true,
              },
            },
          },
        });

        let nextCursorFollowing = null;
        if (followingFromDb.length > limit) {
          nextCursorFollowing = cursor + limit;
          followingFromDb.pop();
        }

        result.following = followingFromDb;
        result.nextCursorFollowing = nextCursorFollowing;
      }
    }

    return result;
  } catch (error) {
    console.error("🔥 Error fetching followers/following info:", error);
    return {
      followers: [],
      following: [],
      nextCursorFollowers: null,
      nextCursorFollowing: null,
    };
  }
};






export const getFollowSuggestions = async (userId) => {
    try {
    //   const loggedInUser = await currentUser();
      // Fetch all users that the given user is already following
      const following = await db.follow.findMany({
        where: {
          followerId: userId,
        },
      });
  
      // Extract the IDs of the users that the given user is already following
      const followingIds = following.map((follow) => follow.followingId);
  
      // Fetch all users that the given user is not already following
      const suggestions = await db.user.findMany({
        where: {
          AND: [
            { id: { not: userId } }, // Exclude the user themselves
            { id: { notIn: followingIds } }, // Exclude users they're already following
          ],
        },
      });
  
      return suggestions;
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  export const updateFollow = async (params) => {
    try {
      const { id, type, userId } = params;
        // const loggedInUser = await currentUser();
        if (!userId) {
            throw new Error("User not authenticated");
          }
        //revise this 
        if (type === "follow") {
            await db.follow.create({
                data: {
                  follower: {
                    connect: { id: userId },
                  },
                  following: {
                    connect: { id },
                  },
                },
              });
              ;
            console.log("User followed");
          } else if (type === "unfollow") {
            // Correct delete operation using where clause
            await db.follow.deleteMany({
              where: {
                followerId: userId,
                followingId: id,
              },
            });
            console.log("User unfollowed");
          }

          // ✅ Invalidate caches for both users
            Promise.all([
            followersCache.invalidateAndWarmBoth(id),      // Target user's followers/following
            followersCache.invalidateAndWarmBoth(userId),  // Current user's followers/following
            ]).catch(err => 
            console.error('Cache warming failed:', err)
            );
      
          return { success: true };
        } catch (e) {
          console.error("Error in updateFollow:", e);
          throw e;
        }
    };
