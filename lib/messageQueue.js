import { Queue } from "bullmq";
import redis from "./redis";

let messageQueue;

if (!messageQueue) {
  messageQueue = new Queue("messages", { connection: redis });
}

export default messageQueue;
