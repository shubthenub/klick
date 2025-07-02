import { Queue } from "bullmq";
import { redis } from "./redis";

export const messageQueue = new Queue("messageQueue", { connection: redis });
