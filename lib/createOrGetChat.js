import prisma from "@/lib/prisma";

export const createOrGetChat = async (userId, otherUserId) => {
  const existingChats = await prisma.chat.findMany({
    where: {
      participants: {
        some: { userId: userId },
      },
    },
    include: {
      participants: true,
    },
  });

  const existingChat = existingChats.find(chat =>
    chat.participants.length === 2 &&
    chat.participants.some(p => p.userId === userId) &&
    chat.participants.some(p => p.userId === otherUserId)
  );

  if (existingChat) return existingChat;

  return await prisma.chat.create({
    data: {
      participants: {
        create: [
          { user: { connect: { id: userId } } },
          { user: { connect: { id: otherUserId } } },
        ],
      },
    },
    include: { participants: true },
  });
};
