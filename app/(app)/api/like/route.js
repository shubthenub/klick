// app/api/like/route.js
import { NextResponse } from "next/server";
import { likeQueue } from "@/lib/likeQueue";
import { invalidatePost } from "@/lib/invalidateCache";

export async function POST(req) {
  try {
    const body = await req.json();
    const { targetId, userId, followerId,likes,  type, action, entityId } = body;

    if (!targetId || !userId || !type || !["like", "unlike"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await likeQueue.add(action, {
      type, // POST, COMMENT, or MESSAGE
      payload: { targetId, userId,followerId,likes, entityId },
    });
    if(type==="POST" || type==="COMMENT") await invalidatePost(targetId); // Invalidate cache for the post

    return NextResponse.json({ success: true, message: "Like action queued" });
  } catch (err) {
    console.error("🔥 Like API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
