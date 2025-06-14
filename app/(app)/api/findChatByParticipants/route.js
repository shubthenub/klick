import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request) {
  try {
    // Test database connection first
    try {
      await db.$queryRaw`SELECT 1`;
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json(
        { message: 'Database connection failed', error: dbError.message },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { participants } = body;

    if (!participants || !Array.isArray(participants)) {
      return NextResponse.json(
        { message: 'Invalid participants array' },
        { status: 400 }
      );
    }

    // Rest of your existing code...
    const candidateChats = await db.chat.findMany({
      where: {
        participants: {
          some: {
            userId: {
              in: participants
            }
          }
        }
      },
      include: {
        participants: true
      }
    });

    const sortedInput = [...participants].sort();
    const exactMatchChat = candidateChats.find(chat => {
      const chatParticipantIds = chat.participants.map(p => p.userId).sort();
      return (
        chatParticipantIds.length === sortedInput.length &&
        chatParticipantIds.every((id, idx) => id === sortedInput[idx])
      );
    });

    return NextResponse.json({
      chatId: exactMatchChat ? exactMatchChat.id : null
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', error: error.message },
      { status: 500 }
    );
  }
}