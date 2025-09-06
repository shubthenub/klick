import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const { userId } = await auth(); // ✅ No await needed
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userChats = await prisma.chatParticipant.findMany({
      where: { userId },
      select: { chatId: true },
    });

    const chatIds = userChats.map(chat => chat.chatId);
    if (chatIds.length === 0) {
      return NextResponse.json({ lastMessages: {} });
    }

    const lastMessages = await Promise.all(
      chatIds.map(async (chatId) => {
        try {
          const lastMessage = await prisma.message.findFirst({
            where: { chatId },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              content: true,
              senderId: true,
              createdAt: true,
              type: true,
              chatId: true,
            },
          });

          if (!lastMessage) return { chatId, lastMessage: null };

          let seen = false;
          if (lastMessage) {
            let seenById;
            if (lastMessage.senderId === userId) {
              // Message sent by me: check if the follower has seen it
              // You need to know the follower's userId for this chat!
              // Let's assume you have a way to get the other participant:
              const chat = await prisma.chat.findUnique({
                where: { id: chatId },
                select: { participants: true },
              });
              // Find the other participant (not me)
              const otherUserId = chat.participants.find(p => p.userId !== userId)?.userId;
              if (otherUserId) {
                const seenEntry = await prisma.seen.findUnique({
                  where: {
                    id_type_seenBy: {
                      id: lastMessage.id,
                      type: "MESSAGE",
                      seenBy: otherUserId,
                    },
                  },
                });
                seen = !!seenEntry;
              }
            } else {
              // Message sent by follower: check if I have seen it
              const seenEntry = await prisma.seen.findUnique({
                where: {
                  id_type_seenBy: {
                    id: lastMessage.id,
                    type: "MESSAGE",
                    seenBy: userId,
                  },
                },
              });
              seen = !!seenEntry;
            }
          }

          return { chatId, lastMessage: { ...lastMessage, seen } };
        } catch (err) {
          console.error(`Error fetching last message for chat ${chatId}:`, err);
          return { chatId, lastMessage: null };
        }
      })
    );

    const lastMessagesMap = {};
    lastMessages.forEach(({ chatId, lastMessage }) => {
      if (lastMessage) {
        lastMessagesMap[chatId] = lastMessage;
      }
    });

    return NextResponse.json({ lastMessages: lastMessagesMap });
  } catch (error) {
    console.error("Error fetching last messages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
