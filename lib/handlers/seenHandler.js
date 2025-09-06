import { db } from '../db.js';
import { pusher } from '../pusher.js';

export const handleSeen = async ({ id, type, chatId, userId }) => {
  try {
    await db.Seen.create({
      data: {
        id,
        type,
        seenBy: userId,
      },
    });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
  }
  await pusher.trigger(`private-chat-${chatId}`, "message-seen", {
    messageId: id,
    seenBy: userId,
    chatId,
  });
  return { success: true };
}; 