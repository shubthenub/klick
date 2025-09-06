import { Worker } from "bullmq";
import Redis from "ioredis";
import { handleAddComment, handleDeleteComment } from "../lib/handlers/commentHandler.js";
import { db } from "../lib/db.js";
import { pusher } from "../lib/pusher.js";


// 1. SIMPLE Redis connection (no fancy options that could break)
const redisUrl = process.env.REDIS_URL;
let connection;
if (redisUrl && redisUrl.startsWith("rediss://")) {
  connection = new Redis(redisUrl, { tls: {} , maxRetriesPerRequest: null,
  connectTimeout: 5000});
} else {
  connection = new Redis(redisUrl,{maxRetriesPerRequest: null,
  connectTimeout: 5000});
}

// 2. BULLETPROOF Worker Setup
const worker = new Worker("comments", async job => {
  console.log(`PROCESSING JOB ${job.id}`);
  
  // YOUR ACTUAL JOB LOGIC HERE
  if (job.data.type === "create") {
    await handleCreateComment(job.data.payload);
  } else {
    await handleDeleteCommentJob(job.data.payload);
  }
  
  console.log(`FINISHED JOB ${job.id}`);
}, {
  connection,
  concurrency: 1, // ← START WITH 1 TO TEST
  lockDuration: 30000
});

// 3. CRITICAL - Add these exact event listeners
worker.on("completed", job => {
  console.log(`✅ DONE ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.log(`❌ FAILED ${job.id}:`, err.message);
});

console.log("Worker ready - ALL jobs will process now");

// --- Handler Functions ---
async function handleCreateComment(newComment) {
  // Notification for the post author
    if (newComment.postAuthorId !== newComment.commentAuthorId) {
        await db.Notification.create({
            data: {
                toUserId: newComment.postAuthorId,
                fromUserId: newComment.commentAuthorId,
                postId: newComment.postId,
                commentId: newComment.id,
                message: "commented on your post",
                type: "COMMENT",
            },
        });

        await pusher.trigger(`Notification-${newComment.postAuthorId}`, "new-noti", {
            id: newComment.id,
            fromUser: newComment.commentAuthor,
            postId: newComment.postId,
            message: "commented on your post",
            post: { media: newComment.postMedia },
            createdAt: new Date().toISOString(),
        });
    }

    // Notification for the parent comment author (if applicable)
    if (newComment.hasParent && newComment.parentAuthorId &&
        newComment.parentAuthorId !== newComment.commentAuthorId &&
        newComment.parentAuthorId !== newComment.postAuthorId) {
        await db.Notification.create({
            data: {
                toUserId: newComment.parentAuthorId,
                fromUserId: newComment.commentAuthorId,
                postId: newComment.postId,
                commentId: newComment.id,
                message: `replied to your comment on ${newComment.postAuthorUsername}'s post`,
                type: "COMMENT",
            },
        });

        await pusher.trigger(`Notification-${newComment.parentAuthorId}`, "new-noti", {
            id: newComment.id,
            fromUser: newComment.commentAuthor,
            postId: newComment.postId,
            message: `replied to your comment on ${newComment.postAuthorUsername}'s post`,
            post: { media: newComment.postMedia },
            createdAt: new Date().toISOString(),
        });
    }

  return { success: true };
}

async function handleDeleteCommentJob(payload) {
  await handleDeleteComment(payload);
  await pusher.trigger(`user-${payload.userId}`, "comment-deleted", {
    deleted: true,
    id: payload.commentId,
  });
  return { success: true };
}