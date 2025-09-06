// app/api/post/route.js
import { NextResponse } from "next/server";
import { postQueue } from "@/lib/postQueue";
import { invalidateFeeds } from "@/lib/invalidateCache";
import { invalidatePost } from "@/lib/invalidateCache";
import { redisSet } from "@/lib/redisSet";
export async function POST(req) {
  try {
    const body = await req.json();
    const { postText = "", userId, media = [] } = body;

    console.log("💡 postText:", postText);
    console.log("💡 userId:", userId);
    console.log("💡 media count:", media.length);
    console.log("💡 media types:", media.map(m => m.type));

    const totalSize = JSON.stringify(media).length;
    if (totalSize > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Media files too large." }, { status: 413 });
    }

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    if (!postText.trim() && media.length === 0) {
      return NextResponse.json({ error: "Post cannot be empty" }, { status: 400 });
    }

    // ✅ Queue job instead of direct DB call
    await postQueue.add("create-post", {
      type: "create",
      data: { postText, media, userId },
    });
     // The invalidateFeeds function will handle finding the followers and deleting the keys.
      await invalidateFeeds(userId);


    return NextResponse.json({ success: true, message: "Post is being processed." });
  } catch (err) {
    console.error("🔥 API Error:", err.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
