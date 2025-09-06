import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all chats where user is a participant
    const userChats = await prisma.chatParticipant.findMany({
      where: { userId },
      select: { chatId: true },
    });

    const chatIds = userChats.map(chat => chat.chatId);

    if (chatIds.length === 0) {
      return NextResponse.json({ unreadCounts: {} });
    }

    // Get unread counts for each chat
    const unreadCounts = await Promise.all(
      chatIds.map(async (chatId) => {
        // Get all messages in this chat that are NOT sent by current user
        const messagesFromOthers = await prisma.message.findMany({
          where: { 
            chatId,
            senderId: { not: userId } // Messages from other participants
          },
          select: { id: true },
        });

        const messageIds = messagesFromOthers.map(msg => msg.id);

        if (messageIds.length === 0) {
          return { chatId, unreadCount: 0 };
        }

        // Get which of these messages have been seen by current user
        const seenMessages = await prisma.seen.findMany({
          where: {
            seenBy: userId,
            id: { in: messageIds },
          },
          select: { id: true },
        });

        const seenMessageIds = new Set(seenMessages.map(seen => seen.id));
        const unreadCount = messageIds.filter(id => !seenMessageIds.has(id)).length;

        return { chatId, unreadCount };
      })
    );

    // Format as object with chatId as key
    const unreadCountsMap = {};
    unreadCounts.forEach(({ chatId, unreadCount }) => {
      unreadCountsMap[chatId] = unreadCount;
    });

    return NextResponse.json({ unreadCounts: unreadCountsMap });
  } catch (error) {
    console.error("Error fetching unread counts:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
