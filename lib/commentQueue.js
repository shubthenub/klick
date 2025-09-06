import { Queue } from "bullmq";
import redis from "./redis";

export const commentQueue = new Queue("comments", { connection: redis });
