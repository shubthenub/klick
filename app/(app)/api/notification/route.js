// app/api/notifications/route.js
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const take = parseInt(searchParams.get("take")) || 10;
    const cursor = searchParams.get("cursor");

    const where = { toUserId: userId };
    const orderBy = { createdAt: "desc" };

    const notifications = await prisma.notification.findMany({
      where,
      orderBy,
      take,
      ...(cursor && {
        skip: 1,
        cursor: { id: parseInt(cursor) },
      }),
      include: {
        fromUser: {
          select: {
            id: true,
            username: true,
            image_url: true,
          },
        },
        post: {
        select: {
          id: true,
          postText: true,
          media: true, // assuming it's a string or array of image URLs
        },
      },
      comment: {
        select: {
          id: true,
          comment: true,
          parentId: true,
        },
      },
      },
    });

    const nextCursor = notifications.length === take ? notifications[notifications.length - 1].id : null;

    return NextResponse.json({ notifications, nextCursor });
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
