"use server";

import { db } from "@/lib/db";
import { checkForTrends } from "@/utils";
import { auth } from "@clerk/nextjs/server";
import { getAllFollowersAndFollowingInfo } from "./user";

export const createPost = async (post, userId) => {
    try {
        console.log("Received Post Data:", post); // Debugging
        console.log("Received User ID:", userId); // Debugging

        // Ensure post is an object
        if (!post || typeof post !== "object") {
            throw new Error("Invalid post data");
        }

        const { postText = "", media = null } = post; // Default values for postText and media

        if (!userId) {
            console.log("User ID is missing or invalid:", userId); // Debugging
            throw new Error("User not authenticated");
        }

        console.log("User ID:", userId); // Debugging
        console.log("Post Text:", postText); // Debugging
        console.log("Media:", media); // Debugging

        // Check if the user exists in the database
        const userExists = await db.User.findUnique({
            where: { id: userId },
        });

        if (!userExists) {
            throw new Error("User does not exist in the database");
        }

        // Create the post in the database
        const newPost = await db.Post.create({
            data: {
                postText: postText,
                media, // Ensure media field is allowed in your DB schema
                authorId: userId, // Ensure this matches your schema
            },
        });

        console.log("Post Created Successfully:", newPost); // Debugging

        //check if post contains hashtags
        const trends = checkForTrends(postText);
        if(trends.length>0){
            createTrends(trends , newPost.id);
        }

        return { data: newPost };
    } catch (e) {
        console.error("Error creating post:", e); // Log detailed error
        throw e; // This will be caught by useMutation
    }
};

export const deletePost = async (postId, userId) => {
    try {
        // Verify post exists and belongs to the user
        const post = await db.Post.findUnique({
            where: { id: postId },
        });

        if (!post) {
            throw new Error("Post not found");
        }

        if (post.authorId !== userId) {
            throw new Error("Unauthorized to delete this post");
        }

        // Delete associated comments, likes, and trends first (if foreign key constraint)
        await db.comment.deleteMany({ where: { postId } });
        await db.like.deleteMany({ where: { postId } });
        await db.trend.deleteMany({ where: { postId } });

        // Then delete the post
        await db.Post.delete({ where: { id: postId } });

        return { success: true };
    } catch (error) {
        console.error("Error deleting post:", error);
        throw error;
    }
};

export const getFeed = async (lastCursor, id) => {
    try {
      console.log("Fetching feed for user ID:", id);
      const {followers, following} = await getAllFollowersAndFollowingInfo(id);
      
      const followingIds = following.map((user) => String(user.followingId));
      const followersIds = followers.map((user) => String(user.followerId));
    //   console.log(followersIds); // Debugging
      const allIds = [...new Set([...followingIds, ...followersIds])];
      
      // Always include current user's posts
      if (!allIds.includes(String(id))) {
        allIds.push(String(id));
      }
  
      const where = {authorId: {in: allIds}};
      const take = 5;
  
      const posts = await db.Post.findMany({
        include: {
          author: true,
          likes: true,
          comments: { include: { author: true } }
        },
        where,
        take,
        ...(lastCursor && { skip: 1, cursor: { id: lastCursor } }),
        orderBy: { createdAt: "desc" }
      });
  
      console.log("Fetched posts:", posts); // Moved before return
  
      if(posts.length === 0) {
        return {
          data: [],
          metadata: { lastCursor: null, hasMore: false }
        };
      }
  
      const lastPost = posts[posts.length - 1];
      const cursor = lastPost.id;
      const morePosts = await db.Post.findMany({
        where,
        take,
        skip: 1,
        cursor: { id: cursor },
        orderBy: { createdAt: "desc" }
      });
  
      return {
        data: posts,
        metadata: {
          lastCursor: cursor,
          hasMore: morePosts.length > 0
        }
      };
  
    } catch (e) {
      console.error("Error fetching feed:", e);
      throw e;
    }
  };
//function to get feed of ur own 
export const getMyPosts = async (lastCursor, id) => {
    try {
      // const { id: userId } = await currentUser();
      const take = 5;
      const where = id !== "all" ? { author: { id } } : {};
      const posts = await db.post.findMany({
        include: {
          author: true,
          likes: true,
          comments: {
            include: {
              author: true,
            },
          },
        },
        where,
        take,
        ...(lastCursor && {
          skip: 1,
          cursor: {
            id: lastCursor,
          },
        }),
        orderBy: {
          createdAt: "desc",
        },
      });
  
      if (posts.length === 0) {
        return {
          data: [],
          metaData: {
            lastCursor: null,
            hasMore: false,
          },
        };
      }
      const lastPostInResults = posts[posts.length - 1];
      const cursor = lastPostInResults?.id;
  
      const morePosts = await db.post.findMany({
        where,
        take,
        skip: 1,
        cursor: {
          id: cursor,
        },
      });
      return {
        data: posts,
        metaData: {
          lastCursor: cursor,
          hasMore: morePosts.length > 0,
        },
      };
    } catch (e) {
      console.log(e);
      throw Error("Failed to fetch posts");
    }
  };
export const updatePostLike = async (postId, actionType, userId) => {
    console.log("Updating post like with:", { postId, actionType, userId });

    if (!postId || !userId || !actionType) {
        console.error("Invalid input data:", { postId, actionType, userId });
        throw new Error("Missing required fields");
    }

    try {
        const post = await db.Post.findUnique({
            where: { id: postId },
            include: { likes: true },
        });

        if (!post) {
            console.error("Post not found");
            return { error: "Post not found" };
        }

        const existingLike = post.likes.find((like) => like.authorId === userId);

        if (actionType === "like" && !existingLike) {
            await db.Like.create({
                data: {
                    post: { connect: { id: postId } },
                    author: { connect: { id: userId } },
                },
            });
            console.log("✅ Like added successfully");
        } else if (actionType === "unlike" && existingLike) {
            await db.Like.deleteMany({
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

export const addComment = async (postId, comment , userId) => {
    try {
        const newComment = await db.comment.create({
            data:{
                comment,
                post:{
                    connect:{
                        id:postId
                    }
                },
                author:{
                    connect:{
                        id:userId
                    }
                }
            }
        });
        console.log("comment created" , newComment);
        return {
            data:newComment
        }
    } catch (e) {
        console.log(e);
    }
}

export const createTrends = async (trends, postId) => {
    try {
        if (!Array.isArray(trends) || trends.length === 0) {
            throw new Error("Invalid trends array");
        }
        if (!postId) throw new Error("Invalid postId");

        const newTrends = await db.trend.createMany({
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
        const trends = await db.trend.groupBy({
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



