// lib/redis.js
import Redis from "ioredis";
import redis from "./redis.js"; // Import the redis instance
// Ensure the redis instance is created only once
export async function redisSet(key, data , ttlSeconds = 300) {
  await redis.set(key, data, "EX", ttlSeconds); // ✅ Fix here
}

export async function redisGet(key) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}
