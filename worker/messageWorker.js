import { PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import Redis from "ioredis";

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
// Add connection event listeners
connection.on('connect', () => {
  console.log('🔗 Redis connected successfully');
});

connection.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

connection.on('ready', () => {
  console.log('✅ Redis is ready to accept commands');
});

console.log("🔗 Redis URL:", process.env.REDIS_URL);

const messageWorker = new Worker(
  "messages",
  async (job) => {
    try {
      console.log("📥 Processing job:", job.id, "with data:", job.data);
      const { id, content, chatId, senderId, replyToId, type, sharedPostId } = job.data;

      await prisma.message.create({
        data: { 
          id, 
          content, 
          chatId, 
          senderId, 
          replyToId,
          type: type || "TEXT",
          ...(sharedPostId && { sharedPostId: parseInt(sharedPostId) }),
        },
      });

      console.log(`✅ Message saved to DB from queue: ${id} with type: ${type || 'TEXT'}`);
    } catch (error) {
      console.error("❌ Failed to process job:", job.id);
      console.error("🚨 Error details:", error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
  }
);

// Add more detailed event listeners
messageWorker.on("ready", () => {
  console.log("🚀 Message worker is ready to process jobs");
});

messageWorker.on("active", (job) => {
  console.log(`🔄 Job ${job.id} has started processing`);
});

messageWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

messageWorker.on("failed", (job, err) => {
  console.error(`❗ Job ${job?.id} failed with error:`, err);
});

messageWorker.on("error", (err) => {
  console.error("�� Worker-level error:", err);
});

// Keep the process alive
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down worker...');
  await messageWorker.close();
  await connection.quit();
  process.exit(0);
});
