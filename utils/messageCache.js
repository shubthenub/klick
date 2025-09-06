// utils/messagesCache.js
import { redisSet, redisGet } from '@/lib/redisSet';
import prisma from '@/lib/prisma';

export const messagesCache = {
  // Get cache key
  getCacheKey: (chatId) => `messages:${chatId}:page1`,

  // Warm messages cache for a chat
  warmMessagesCache: async (chatId) => {
    try {
      const messages = await prisma.message.findMany({
        where: { chatId },
        include: {
          sender: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              image_url: true,
              username: true,
            }
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              senderId: true,
              type: true,
            }
          },
          sharedPost: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  first_name: true,
                  last_name: true,
                }
              }
            }
          },
          Like: {
            select: { authorId: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 40
      });

      // Get chat info
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          participants: {
            select: { userId: true }
          }
        }
      });

      const cacheData = {
        messages,
        chat
      };

      const cacheKey = messagesCache.getCacheKey(chatId);
      const TTL = 300; // 5 minutes
      await redisSet(cacheKey, JSON.stringify(cacheData), TTL);
      console.log(`✅ Warmed messages cache for chat ${chatId} (${messages.length} messages)`);
      return cacheData;
    } catch (error) {
      console.error(`❌ Failed to warm messages cache for chat ${chatId}:`, error);
      throw error;
    }
  },

  // Invalidate and re-warm messages cache
  invalidateAndWarm: async (chatId) => {
    try {
      await messagesCache.warmMessagesCache(chatId);
    } catch (error) {
      console.error(`Failed to invalidate messages cache for chat ${chatId}:`, error);
    }
  }
};
