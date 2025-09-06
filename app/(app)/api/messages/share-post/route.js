import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createOrGetChat } from "@/lib/createOrGetChat";
import { pusher } from "@/lib/pusher";
import { redisSet } from "@/lib/redisSet";
import { Queue } from "bullmq";
import Redis from "ioredis";
import prisma from "@/lib/prisma";

const redisUrl = process.env.REDIS_URL;
let connection;
if (redisUrl && redisUrl.startsWith("rediss://")) {
  connection = new Redis(redisUrl, { tls: {} });
} else {
  connection = new Redis(redisUrl);
}

const messageQueue = new Queue("messages", { connection });

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { postId, recipientIds, messageText } = body;

    if (!postId || !recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: parseInt(postId) },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const sentAt = Date.now();
    const createdAt = new Date().toISOString();

    // Send to each recipient
    const results = await Promise.all(
      recipientIds.map(async (recipientId) => {
        try {
          // Get or create chat
          const chat = await createOrGetChat(userId, recipientId);
          const chatId = chat.id;

          // Create message ID
          const messageId = `shared-post-${postId}-${userId}-${recipientId}-${Date.now()}`;

          // Content will be the message text (optional text with shared post)
          const messageContent = messageText || "";

          // Store in Redis
          // await redisSet(`message:${messageId}`, {
          //   id: messageId,
          //   chatId: chatId,
          //   senderId: userId,
          //   content: messageContent,
          //   status: "sent",
          //   createdAt,
          //   type: "SHARED_POST",
          //   sharedPostId: postId,
          // });

          // Trigger pusher
          await pusher.trigger(`private-chat-${chatId}`, "new-message", {
            id: messageId,
            chatId: chatId,
            senderId: userId,
            content: messageContent,
            status: "sent",
            createdAt,
            sentAt,
            type: "SHARED_POST",
            sharedPostId: postId,
          });

          // Add to queue for persistence
          const job = await messageQueue.add("persist-message", {
            id: messageId,
            chatId: chatId,
            senderId: userId,
            content: messageContent,
            type: "SHARED_POST",
            sharedPostId: postId,
          });

          console.log(`✅ Shared post sent to ${recipientId}, job ID: ${job.id}`);

          return { recipientId, success: true, messageId };
        } catch (error) {
          console.error(`❌ Failed to send to ${recipientId}:`, error);
          return { recipientId, success: false, error: error.message };
        }
      })
    );

    const successfulSends = results.filter(r => r.success);
    const failedSends = results.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      message: `Shared post with ${successfulSends.length} recipient(s)`,
      results: {
        successful: successfulSends,
        failed: failedSends,
      }
    });

  } catch (error) {
    console.error("POST /api/messages/share-post error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}