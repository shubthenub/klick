import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
let redis;

if (redisUrl && redisUrl.startsWith("rediss://")) {
  redis = new Redis(redisUrl, { tls: {} });
} else {
  redis = new Redis(redisUrl);
}

// Redis SET function
export async function redisSet(key, data, ttlSeconds = 300) {
  try {
    const serializedData = JSON.stringify(data);
    
    if (ttlSeconds) {
      // Set with TTL using SETEX
      await redis.setex(key, ttlSeconds, serializedData);
    } else {
      // Set without TTL (permanent cache)
      await redis.set(key, serializedData);
    }
    
    console.log(`✅ Redis SET: ${key} (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    console.error('❌ Redis SET error:', error);
    throw error;
  }
}

// Redis GET function with proper JSON parsing
export async function redisGet(key) {
  try {
    const data = await redis.get(key);
    if (data) {
      console.log(`✅ Redis GET HIT: ${key}`);
      return JSON.parse(data);
    } else {
      console.log(`❌ Redis GET MISS: ${key}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Redis GET error:', error);
    return null; // Return null on error to fallback to database
  }
}

// New Redis DEL function
export async function redisDel(key) {
    try {
        await redis.del(key);
        console.log(`🗑️ Redis DEL: ${key}`);
    } catch (error) {
        console.error('❌ Redis DEL error:', error);
        throw error;
    }
}

export default redis;