import { Queue } from "bullmq";
import redis from "./redis";

export const likeQueue = new Queue("likes", { connection: redis });
