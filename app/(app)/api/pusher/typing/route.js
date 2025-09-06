// app/api/pusher/typing/route.js
import { NextResponse } from "next/server";
import { pusher } from "@/lib/pusher"; // This is your server-side Pusher instance

export async function POST(req) {
  const { chatId, userId } = await req.json();
  await pusher.trigger(`private-chat-${chatId}`, "typing", { userId });
  return NextResponse.json({ success: true });
}