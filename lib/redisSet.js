// lib/redis.js
import Redis from "ioredis";
const redis = new Redis(process.env.REDIS_URL,{
  tls: {}, // optional, but recommended for rediss://
});

export async function redisSet(key, data , ttlSeconds = 300) {
  await redis.set(key, data, "EX", ttlSeconds); // ✅ Fix here
}

export async function redisGet(key) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}
