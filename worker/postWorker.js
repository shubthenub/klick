import { Worker } from "bullmq";
import Redis from "ioredis";
import { handleCreatePost, handleDeletePost, handleUpdatePost } from "../lib/handlers/postHandler.js";

const redisUrl = process.env.REDIS_URL;
let connection;
if (redisUrl && redisUrl.startsWith("rediss://")) {
  connection = new Redis(redisUrl, { tls: {} , maxRetriesPerRequest: null,
  connectTimeout: 5000});
} else {
  connection = new Redis(redisUrl,{maxRetriesPerRequest: null,
  connectTimeout: 5000});
}

new Worker(
  "posts",
  async (job) => {
    console.log("🔨 Processing job:", job.id, "Type:", job.name);
    const { type, data } = job.data; // ✅ this works with what you added to the queue

    if (type === "create") {
      const { postText, media, userId } = data;
      await handleCreatePost({ postText, media, userId });
      console.log("✅ Post created via worker");
    }

    if (type === "delete") {
      const { postId, userId } = data;
      await handleDeletePost({ postId, userId });
      console.log("🗑️ Post deleted via worker");
    }

    if (type === "update") {
      const { postId, postText, media } = data;
      await handleUpdatePost({ postId, postText, media });
      console.log("✏️ Post updated via worker");
    }
  },
  { connection }
);
