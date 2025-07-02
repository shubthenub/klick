// /api/seen/route.js
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import Pusher from "pusher";

export async function POST(req) {
  const { id, type, chatId } = await req.json(); // Destructure chatId

  const { userId } = await auth();

  // ✅ Include chatId in the initial validation
  if (!userId || !id || !type || !chatId) {
    console.error("Invalid data: Missing userId, id, type, or chatId");
    return NextResponse.json(
      { error: "Invalid data: Missing userId, id, type, or chatId" },
      { status: 400 }
    );
  }

  try {
    console.log(`Marking message ${id} of type ${type} in chat ${chatId} as seen by user ${userId}`);

    // Try to create the seen entry.
    // If it already exists (P2002 error), Prisma will throw, and you catch it.
    await prisma.seen.create({
      data: {
        id,
        type,
        seenBy: userId,
      },
    });

    // Trigger Pusher
    const pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      useTLS: true,
    });
    await pusher.trigger(`private-chat-${chatId}`, "message-seen", {
      messageId: id,
      seenBy: userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // If it's a P2002 unique constraint error, it means it's already seen, so return 200 OK.
    if (error.code === 'P2002') {
      console.warn(`Attempted to mark already seen message ${id} by ${userId}. Skipping.`);
      return NextResponse.json({ success: true, message: "Already marked as seen" }, { status: 200 });
    }

    console.error("API Error:", {
      code: error.code,
      message: error.message,
      meta: error.meta,
      stack: error.stack // Include stack for better debugging
    });
    return NextResponse.json(
      { error: "Operation failed", details: error.message },
      { status: 500 }
    );
  }
}