import { Worker } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { pusher } from "../lib/pusher.js";
import { redisGet, redisSet } from "../lib/redis.js";

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL;
let connection;
if (redisUrl && redisUrl.startsWith("rediss://")) {
  connection = new Redis(redisUrl, { tls: {}, maxRetriesPerRequest: null, connectTimeout: 5000 });
} else {
  connection = new Redis(redisUrl, { maxRetriesPerRequest: null, connectTimeout: 5000 });
}

console.log("Redis connection established for seenWorker with redisUrl:", redisUrl);

// seenWorker.js
const seenWorker = new Worker(
  "seen",
  async (job) => {
    // Payload now includes senderId
    const { id, type, chatId, userId, senderId } = job.data; 

    try {
      // Update Redis cache.
      await updateSeenStatusInRedis(chatId, id, userId);
      const promises = [
        // 1. Persist to DB first.
        prisma.seen.create({
          data: {
            id,
            type,
            seenBy: userId,
          },
        }).catch(error => {
          if (error.code !== "P2002") throw error;
        }),

        // 2. Trigger for the active chat channel.
        pusher.trigger(`private-chat-${chatId}`, "message-seen", {
          messageId: id,
          seenBy: userId,
          chatId,
        }),
      ];
      
      // 3. Trigger for the message sender's background channel.
      promises.push(
        pusher.trigger(`private-user-${senderId}`, "message-seen", {
          messageId: id,
          seenBy: userId,
          chatId,
        })
      );
      


      await Promise.all(promises);

      console.log(`✅ Seen processed for message ${id} in chat ${chatId} by user ${userId}`);
    } catch (error) {
      console.error(`❌ Error processing seen job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

//  Helper function to update Redis cache
async function updateSeenStatusInRedis(chatId, messageId, userId) {
  try {
    const cacheKey = `messages:${chatId}`;
    const cached = await redisGet(cacheKey);
    
    if (cached && cached.pages && cached.pages[0]?.messages) {
      // Update message seen status in cache - maintain React Query structure
      const updatedMessages = cached.pages[0].messages.map(msg => 
        msg.id === messageId ? { ...msg, seen: true, toBeSeen: false } : msg
      );
      
      const updatedCache = {
        ...cached,
        pages: [{
          ...cached.pages[0],
          messages: updatedMessages
        }]
      };
      
      await redisSet(cacheKey, updatedCache, 600);
      console.log('✅ Updated message seen status in Redis cache');
    }
    
    // Update lastMessage cache if needed
    const lastMessageKey = `lastMessage:${chatId}`;
    const lastMessage = await redisGet(lastMessageKey);
    if (lastMessage && lastMessage.id === messageId) {
      await redisSet(lastMessageKey, { ...lastMessage, seen: true }, 18000);
      console.log('✅ Updated lastMessage seen status in Redis cache');
    }
  } catch (error) {
    console.error('❌ Failed to update Redis cache for seen status:', error);
    // Fallback: invalidate cache
    try {
      await connection.del(`messages:${chatId}`);
      await connection.del(`lastMessage:${chatId}`);
      console.log('🔄 Fallback: Deleted cache due to update failure');
    } catch (delError) {
      console.error('❌ Failed to delete cache as fallback:', delError);
    }
  }
}

seenWorker.on("completed", (job) => {
  console.log(`✅ Seen job ${job.id} completed`);
});
seenWorker.on("failed", (job, err) => {
  console.error(`❌ Seen job ${job?.id} failed:`, err);
});