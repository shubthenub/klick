// /api/seen/route.js (hypothetical file)
import { NextResponse } from "next/server";
import { seenQueue } from "@/lib/seenQueue";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const { id, type, chatId, userId, senderId } = await req.json(); // userId is from auth() or similar

    // 2. Add the senderId to the job payload.
    await seenQueue.add("mark-as-seen", {
      id,
      type,
      chatId,
      userId, // The user who saw the message
      senderId,// The user who sent the message
    });

    return NextResponse.json({ success: true, message: "Seen action queued" });
  } catch (err) {
    console.error("🔥 Seen API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}