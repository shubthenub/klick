// lib/redis.js
import Redis from "ioredis";
import redis from "./redis.js"; // Import the redis instance
// Ensure the redis instance is created only once
export async function redisSet(key, data, ttlSeconds = 300) {
  try {
    const serializedData = JSON.stringify(data);
    
    if (ttlSeconds) {
      // Set with TTL
      await redis.set(key, serializedData, "EX", ttlSeconds);
    } else {
      // Set without TTL (permanent cache for followers)
      await redis.set(key, serializedData);
    }
  } catch (error) {
    console.error('Redis SET error:', error);
    throw error;
  }
}

// Redis GET function with proper JSON parsing
export async function redisGet(key) {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null; // Return null on error to fallback to database
  }
}
