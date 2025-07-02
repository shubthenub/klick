const { Worker } = require("bullmq");
const Redis = require("ioredis");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  tls: {} // <-- needed for Upstash if using `rediss://`
});
console.log("🔗 Redis URL:", process.env.REDIS_URL);

const messageWorker = new Worker(
  "messages",
  async (job) => {
    
    const { id, content, chatId, senderId, replyToId } = job.data;

    await prisma.message.create({
      data: { id, content, chatId, senderId, replyToId },
    });

    console.log(`✅ Message saved to DB from queue: ${id} with replyToId: ${replyToId}`);
  },
  { connection }
);
