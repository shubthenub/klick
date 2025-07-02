import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { createOrGetChat } from "@/lib/createOrGetChat";
import { createClient } from "@supabase/supabase-js";
import Pusher from "pusher";
import { auth, currentUser } from '@clerk/nextjs/server'
import { pusher } from "@/lib/pusher";
import { redisSet } from "@/lib/redisSet";
import { Queue } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL,{
  maxRetriesPerRequest: null,
  tls: {}, // optional, but recommended for rediss://
});
const messageQueue = new Queue("messages", { connection });
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

    // Build dynamic where clause
    let whereClause = {
      chatId: chat.id,
    };

    if (beforeId) {
      const beforeMsg = await prisma.message.findUnique({
        where: { id: beforeId },
        select: { createdAt: true },
      });

      if (beforeMsg) {
        whereClause.createdAt = { lt: beforeMsg.createdAt };
      }
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
          },
        },
      },
    });

    const messageIds = messages.map((msg) => msg.id);

    const seenEntries = await prisma.seen.findMany({
  where: {
    seenBy: otherUserId,
    id: { in: messageIds },
  },
  select: { id: true },
});

const seenMap = new Set(seenEntries.map((entry) => entry.id));

// Append `seen: true/false` to each message directly
const enrichedMessages = messages.map((msg) => ({
  ...msg,
  seen: seenMap.has(msg.id),
}));

return NextResponse.json({
  chat,
  messages: enrichedMessages.reverse(), // oldest first
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
    const { id, content, type ,chatId, replyToId, replyTo} = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    if(!chatId) {const chat = await createOrGetChat(userId, otherUserId)};
    
   
    const sentAt = Date.now(); // milliseconds
    const createdAt= new Date().toISOString()

    // 1. Store in Redis
    const redisPromise= redisSet(`message:${id}`, {
      id,
      chatId: chatId,
      senderId: userId,
      content,
      status: "sent",
      createdAt,
      replyToId: replyToId || null,
    });


    // 2. Trigger pusher immediately
    const pusherPromise= pusher.trigger(`private-chat-${chatId}`, "new-message", {
      id,
      chatId: chatId,
      senderId: userId,
      content,
      status: "sent",
      createdAt,
      sentAt, // add this
      replyToId: replyToId ,
      replyTo: replyTo ,
    });

    // 3. THEN add to queue (this is backend-only, not user-facing)
    const queuePromise= messageQueue.add("persist-message", {
      id,
      chatId: chatId,
      senderId: userId,
      content,
      replyToId: replyToId || null,
    },
      {
        attempts: 3, // Retry up to 5 times
        backoff: {
          type: "exponential",
          delay: 2000, // Start with 1 second delay
        },
      }
  );
  await Promise.all([redisPromise, pusherPromise, queuePromise]);

  return NextResponse.json({
    id,
    senderId: userId,
    content,
    chatId: chatId,
    status: "sent",
    replyToId: replyToId || null,
  });
}
catch (error) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }}