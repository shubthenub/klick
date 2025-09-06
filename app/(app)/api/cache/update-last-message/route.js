// /api/cache/update-last-message/route.js
import { NextResponse } from "next/server";
import { redisSet } from "@/lib/redis";

export async function POST(req) {
  try {
    const { chatId, message } = await req.json();
    
    if (!chatId || !message) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Update last message cache
    await redisSet(`lastMessage:${chatId}`, message, 1800);
    
    // Optionally invalidate first page cache for fresh reload
    await redis.del(`messages:${chatId}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cache update error:', error);
    return NextResponse.json({ error: "Cache update failed" }, { status: 500 });
  }
}
