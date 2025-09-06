import { Queue } from "bullmq";
import redis from "./redis";

export const seenQueue = new Queue("seen", { connection: redis }); 