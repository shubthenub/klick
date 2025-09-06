import { NextResponse } from "next/server";
import { commentQueue } from "@/lib/commentQueue";
import { invalidatePost } from "@/lib/invalidateCache";
import { handleAddComment } from "@/lib/handlers/commentHandler";

export async function POST(req) {
  try {
    const body = await req.json();
    const { postId, commentText, userId, parentId } = body;

    if (!postId || !commentText || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const newComment = await handleAddComment({
      postId,
      comment: commentText,
      userId,
      parentId: parentId || null,
    });

    await commentQueue.add("create", {
      type: "create",
      payload: newComment,
    });

    return NextResponse.json(newComment);
  } catch (e) {
    console.error("🔥 Comment API Error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json();
    const { commentId, userId } = body;

    if (!commentId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await commentQueue.add("delete", {
      type: "delete",
      payload: {
        commentId,
        userId,
      },
    });
    // Note: Post cache invalidation is handled in the comment handler

    return NextResponse.json({ success: true, message: "Comment deletion queued" });
  } catch (e) {
    console.error("🔥 Comment API Error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
