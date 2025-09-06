import { Queue } from "bullmq";
import redis from "./redis";

export const postQueue = new Queue("posts", { connection: redis });

