import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { createOrGetChat } from "@/lib/createOrGetChat";
import { createClient } from "@supabase/supabase-js";
import Pusher from "pusher";
import { auth, currentUser } from '@clerk/nextjs/server'
import { pusher } from "@/lib/pusher";
import  redis, {redisSet, redisGet, redisDel } from "@/lib/redis";
import { Queue } from "bullmq";
import Redis from "ioredis";
// import redis from "@/lib/redis";

const redisUrl = process.env.REDIS_URL;
// let connection;
// if (redisUrl && redisUrl.startsWith("rediss://")) {
//   connection = new Redis(redisUrl, { tls: {} });
// } else {
//   connection = new Redis(redisUrl);
// }


const messageQueue = new Queue("messages", { connection:redis });
const publicKey = process.env.CLERK_PEM_PUBLIC_KEY;
// console.log(publicKey)

const permittedOrigins = [
  'http://localhost:3000',
  'https://cheaply-touching-clam.ngrok-free.app',
  'https://klicktest.loophole.site',
  'https://klick-one.vercel.app'
];

function verifyClerkToken(token) {
  if (!token) throw new Error("No token provided");
  const options = { algorithms: ['RS256'] };
  const decoded = jwt.verify(token, publicKey, options);

  const currentTime = Math.floor(Date.now() / 1000);
  if (decoded.exp < currentTime) throw new Error("Token expired");
  if (decoded.nbf && decoded.nbf > currentTime) throw new Error("Token not active yet");

  if (decoded.azp && !permittedOrigins.includes(decoded.azp)) {
    console.warn(`Warning: azp claim '${decoded.azp}' not in permitted origins`);
  }

  return decoded;
}

function getSupabaseWithToken(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    
  );
}

export async function GET(req, { params }) {
  try {
    const { userId } = await auth(); 
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { followerId: otherUserId } = params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const beforeId = searchParams.get("before");

    const chat = await createOrGetChat(userId, otherUserId);
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    const chatId = chat.id;
    const isFirstPage = !beforeId; // First page when no 'before' parameter

    // ✅ Check cache only for first page
    if (isFirstPage) {
      const cacheKey = `messages:${chatId}`;
      const cached = await redisGet(cacheKey);
      
      // ✅ FIX: Check for the correct cache structure
      if (cached && cached.pages && cached.pages[0]?.messages) {
        console.log('✅ Cache HIT for chat:', chatId);
        
        // Return cached data with proper structure
        return NextResponse.json({
          chat: cached.chat,
          messages: cached.pages[0].messages.slice(0, limit),
          seenMessageIds: cached.seenMessageIds || [] // Access from root level
        });
      }
    }

    console.log('❌ Cache MISS - fetching from DB for chat:', chatId);

    // Build dynamic where clause (your existing logic)
    let whereClause = { chatId };

    if (beforeId) {
      const beforeMsg = await prisma.message.findUnique({
        where: { id: beforeId },
        select: { createdAt: true },
      });
      if (beforeMsg) {
        whereClause.createdAt = { lt: beforeMsg.createdAt };
      }
    }

    // Fetch messages (your existing query)
    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        replyTo: {
          select: {
            id: true, content: true, senderId: true, type: true,
            sharedPost: { include: { author: true } }
          },
        },
        sharedPost: { include: { author: true } },
        Like: true,
      },
    });

    const messageIds = messages.map((msg) => msg.id);

    // Get seen status (your existing logic)
    const seenByOtherEntries = await prisma.seen.findMany({
      where: { seenBy: otherUserId, id: { in: messageIds } },
      select: { id: true },
    });

    const seenByCurrentEntries = await prisma.seen.findMany({
      where: { seenBy: userId, id: { in: messageIds } },
      select: { id: true },
    });

    const seenByOtherMap = new Set(seenByOtherEntries.map((entry) => entry.id));
    const seenByCurrentMap = new Set(seenByCurrentEntries.map((entry) => entry.id));

    // Enrich messages with seen status (your existing logic)
    const enrichedMessages = messages.map((msg) => ({
      ...msg,
      seen: msg.senderId === userId ? seenByOtherMap.has(msg.id) : seenByCurrentMap.has(msg.id),
    }));

    const finalMessages = enrichedMessages.reverse(); // oldest first

    // ✅ Cache ONLY first page as single object
    if (isFirstPage && finalMessages.length > 0) {
      const cacheData = {
        chat, // Keep chat at root level
        pages: [{
          messages: finalMessages
          // Remove seenMessageIds and timestamp from pages[0]
        }],
        seenMessageIds: Array.from(seenByCurrentMap), // Move to root level
        timestamp: Date.now() // Move to root level
      };
      
      // Single cache write - 10 minutes TTL
      await redisSet(`messages:${chatId}`, cacheData, 6000);
      
      // Cache last message for sidebar - 30 minutes TTL
      const lastMessage = finalMessages[finalMessages.length - 1];
      await redisSet(`lastMessage:${chatId}`, lastMessage, 18000);
      
      console.log('💾 Cached first page for chat:', chatId, '- Messages:', finalMessages.length);
    }

    return NextResponse.json({
      chat,
      messages: finalMessages,
      seenMessageIds: Array.from(seenByCurrentMap),
    });

  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}




export async function POST(req, { params }) {
      try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { followerId: otherUserId } = params;
        const body = await req.json();
        const { id, content, type, chatId, replyToId, replyTo, sharedPostId } = body;

        if (!content?.trim()) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        let finalChatId = chatId;
        if (!finalChatId) {
            const chat = await createOrGetChat(userId, otherUserId);
            finalChatId = chat.id;
        }

        const sentAt = Date.now();
        const createdAt = new Date().toISOString();

        // Prepare message data. This is the optimistic data.
        const messageData = {
            id,
            chatId: finalChatId,
            senderId: userId,
            content,
            status: "sent",
            createdAt,
            sentAt,
            replyToId: replyToId,
            replyTo: replyTo,
            type: type || "TEXT",
            ...(sharedPostId && { sharedPostId }),
            seen: false,
        };

        // --- All promises to run concurrently ---
        const promises = [
            // 1. Pusher promises for real-time update
            pusher.trigger(`private-chat-${finalChatId}`, "new-message", messageData),
            pusher.trigger(`private-user-${otherUserId}`, "background-message", {
                chatId: finalChatId,
                message: messageData,
            }),

            // 2. BullMQ queue promise to persist the message to DB
            messageQueue.add("persist-message", {
                id,
                chatId: finalChatId,
                senderId: userId,
                content,
                replyToId: replyToId || null,
                type: type || "TEXT",
                ...(sharedPostId && { sharedPostId }),
            }, {
                attempts: 3,
                backoff: { type: "exponential", delay: 2000 },
            }),

            // 3. Redis promises for caching
            (async () => {
                const cacheKey = `messages:${finalChatId}`;
                const existingCache = await redisGet(cacheKey);
                const MAX_CACHED_MESSAGES = 40; // You can adjust this number

                if (existingCache && existingCache.pages && existingCache.pages[0]?.messages) {
                    // Append the new message
                    const updatedMessages = [...existingCache.pages[0].messages, messageData];

                    // ✅ NEW CODE: Keep only the last N messages
                    if (updatedMessages.length > MAX_CACHED_MESSAGES) {
                        // Slice the array to keep only the most recent N messages
                        updatedMessages.splice(0, updatedMessages.length - MAX_CACHED_MESSAGES);
                    }

                    const updatedCache = {
                        ...existingCache,
                        pages: [{
                            ...existingCache.pages[0],
                            messages: updatedMessages,
                        }],
                    };

                    await redisSet(cacheKey, updatedCache, 6000);
                    console.log(`✅ Updated Redis cache with ${updatedMessages.length} messages`);

                    // --- VERIFICATION LOGS ---
                    const verifiedCache = await redisGet(cacheKey);
                    if (verifiedCache) {
                        const lastMessageInCache = verifiedCache.pages[0]?.messages.slice(-1)[0];
                        if (lastMessageInCache && lastMessageInCache.id === messageData.id) {
                            console.log('🔍 VERIFICATION SUCCESS: Main cache updated correctly.');
                            console.log('Content from Redis:', lastMessageInCache.content);
                        } else {
                            console.log('❌ VERIFICATION FAILED: Main cache does not match.');
                        }
                    }
                    // --- END VERIFICATION ---
                }
            })(),

            // 4. Redis promise for lastMessage cache
            (async () => {
                const lastMessageKey = `lastMessage:${finalChatId}`;
                await redisSet(lastMessageKey, messageData, 18000);
                console.log('✅ Updated lastMessage cache');

                // --- VERIFICATION LOGS ---
                const verifiedLastMessage = await redisGet(lastMessageKey);
                if (verifiedLastMessage && verifiedLastMessage.id === messageData.id) {
                    console.log('🔍 VERIFICATION SUCCESS: Last message cache updated correctly.');
                } else {
                    console.log('❌ VERIFICATION FAILED: Last message cache does not match.');
                }
                // --- END VERIFICATION ---
            })(),
        ];

        // Execute all promises concurrently
        await Promise.all(promises);
        console.log("✅ All asynchronous operations (Pusher, BullMQ, Redis) were initiated concurrently.");

        // Return a successful response to the client
        return NextResponse.json({
            id,
            senderId: userId,
            content,
            chatId: finalChatId,
            status: "sent",
            replyToId: replyToId || null,
            type: type || "TEXT",
            ...(sharedPostId && { sharedPostId }),
        });
    } catch (error) {
        console.error("POST /api/messages error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}