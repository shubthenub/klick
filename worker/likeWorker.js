// workers/likeWorker.js
import { Worker } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { pusher } from "../lib/pusher.js";
import { redisGet, redisSet } from "../lib/redis.js";

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL;
let connection;
if (redisUrl && redisUrl.startsWith("rediss://")) {
  connection = new Redis(redisUrl, { tls: {} , maxRetriesPerRequest: null,
  connectTimeout: 5000});
} else {
  connection = new Redis(redisUrl,{maxRetriesPerRequest: null,
  connectTimeout: 5000});
}

const LikeType = {
  POST: "POST",
  COMMENT: "COMMENT",
  MESSAGE: "MESSAGE",
};
console.log("Like Worker initialized");

const likeWorker = new Worker(
  "likes",
  async (job) => {
    console.log(`PROCESSING JOB ${job.id} of type ${job.name}`);
    const { type, payload } = job.data;
    const { targetId, userId,followerId, likes, entityId } = payload;

    const baseData = {
      author: { connect: { id: userId } },
      type: LikeType[type],
      createdAt: new Date(),
    };

    if (type === "POST") baseData.post = { connect: { id: Number(targetId) } };
    if (type === "COMMENT") baseData.comment = { connect: { id: Number(targetId) } };
    if (type === "MESSAGE") baseData.message = { connect: { id: targetId } };

    if (job.name === "like") {
      // / --- MESSAGE LIKE: handle first for real-time speed ---/
      if (type === "MESSAGE") {
      await handleMessageOperation({
        action: "like",
        targetId,
        userId,
        chatId: entityId,
        likes: payload.likes,       // 👈 use likes passed from props
        otherUserIds: [payload.followerId], // 👈 you already have followerId
        type,
        baseData,
      });
      return;
    }

      await prisma.like.create({ data: baseData });
      console.log("✅ Like created with data:", baseData);

      // 🧠 Trigger Notification Only if Target Belongs to Someone Else
      let toUserId = null;
      let postId = null;
      let message = "liked your post";

      if (type === "POST") {
        const post = await prisma.post.findUnique({
          where: { id: Number(targetId) },
          select: { authorId: true },
        });
        if (post?.authorId !== userId) {
          toUserId = post.authorId;
          postId = Number(targetId);
        }
      }

      if (type === "COMMENT") {
        const comment = await prisma.comment.findUnique({
          where: { id: Number(targetId) },
          select: { authorId: true, postId: true },
        });

        if (comment?.authorId !== userId) {
          toUserId = comment.authorId;
          postId = comment.postId;

          const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { author: { select: { username: true } } },
          });

          message = `liked your comment on ${post?.author?.username || "someone"}'s post`;
        }
      }

      if (toUserId && message) {
        const notification = await prisma.notification.create({
          data: {
            message,
            type: "LIKE",
            fromUser: { connect: { id: userId } },
            toUser: { connect: { id: toUserId } },
            ...(postId && { post: { connect: { id: postId } } }),
            ...(type === "COMMENT" && {
              comment: { connect: { id: Number(targetId) } },
            }),
          },
          include: {
            fromUser: {
              select: {
                id: true,
                username: true,
                image_url: true,
              },
            },
          },
        });

        // 📡 Trigger via Pusher
        await pusher.trigger(`notification-${toUserId}`, "new-noti", notification);
        console.log("📢 Pusher: Notification sent to", toUserId);
      }
    }

    if (job.name === "unlike") {
      if (type === "MESSAGE") {
      await handleMessageOperation({
        action: "unlike",
        targetId,
        userId,
        chatId: entityId,
        likes: payload.likes,
        otherUserIds: [payload.followerId],
        type,
        baseData,
      });
      return;
    }
    
      const whereClause = {
        authorId: userId,
        type: LikeType[type],
      };

      if (type === "POST") whereClause.postId = Number(targetId);
      if (type === "COMMENT") whereClause.commentId = Number(targetId);
      if (type === "MESSAGE") whereClause.messageId = targetId;

      await prisma.like.deleteMany({ where: whereClause });
      console.log("✅ Like removed with targetId:", targetId, "and type:", type);

      // 🗑️ Delete related notification
      const notification = await prisma.notification.findFirst({
        where: {
          fromUserId: userId,
          type: "LIKE",
          ...(type === "POST" && { postId: Number(targetId) }),
          ...(type === "COMMENT" && { commentId: Number(targetId) }),
        },
      });

      if (notification) {
        await prisma.notification.delete({ where: { id: notification.id } });
        console.log("🗑️ Notification deleted:", notification.id);

        // 📡 Notify client to remove notification
        await pusher.trigger(`notification-${notification.toUserId}`, "new-noti", {
          deleted: true,
          id: notification.id,
        });
      }
      
    }
  },
  { connection }
);



//helper functions 
    const handleMessageOperation = async ({ 
      action, 
      targetId, 
      userId, 
      chatId, 
      likes, 
      otherUserIds = [], 
      type, 
      baseData 
    }) => {
      const isLike = action === "like";

      let newLikes;
      if (isLike) {
        newLikes = [...likes, { authorId: userId }];
      } else {
        newLikes = [];
      }

      const promises = [
        // DB write/delete
        isLike
          ? prisma.like.create({ data: baseData })
          : prisma.like.deleteMany({
              where: { type: LikeType[type], messageId: targetId },
            }),

        // Pusher trigger for chat
        pusher.trigger(`private-chat-${chatId}`, "message-like-updated", {
          messageId: targetId,
          likes: newLikes,
          chatId,
        }),

        // Pusher triggers for other participants
        ...otherUserIds.map((otherUserId) =>
          pusher.trigger(`private-user-${otherUserId}`, "message-like-updated", {
            messageId: targetId,
            likes: newLikes,
            chatId,
          })
        ),

        // Redis cache update
        (async () => {
          try {
            const cacheKey = `messages:${chatId}`;
            const cached = await redisGet(cacheKey);

            if (cached?.pages?.[0]?.messages) {
              const updatedMessages = cached.pages[0].messages.map((msg) =>
                msg.id === targetId ? { ...msg, Like: newLikes } : msg
              );
              const updatedCache = {
                ...cached,
                pages: [{ ...cached.pages[0], messages: updatedMessages }],
              };
              await redisSet(cacheKey, updatedCache, 600);
              console.log("✅ Updated message likes in cache");
            } else {
              console.log("❌ No cache to update, will be fresh on next fetch");
            }
          } catch (error) {
            console.error("Cache update failed, falling back to invalidation:", error);
            await redisDel(`messages:${chatId}`).catch(console.error);
          }
        })(),
      ];

      await Promise.all(promises);
      console.log(`✅ All operations for ${action.toUpperCase()} completed.`);
      console.log(`Pusher keys verification: private-chat-${chatId}, private-user-${(process.env.NEXT_PUBLIC_PUSHER_KEY||'')}`);

      // Update lastMessage cache
      const lastMessageKey = `lastMessage:${chatId}`;
      const lastMessage = await redisGet(lastMessageKey);
      if (lastMessage && lastMessage.id === targetId) {
        await redisSet(lastMessageKey, { ...lastMessage, Like: newLikes }, 18000);
        console.log("✅ Updated lastMessage cache with new likes.");
      }
    };
