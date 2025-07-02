import Redis from "ioredis";

let redis;

if (!redis) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: {},
  });
}
export default redis;