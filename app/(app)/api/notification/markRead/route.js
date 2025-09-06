// app/api/notification/markRead/route.js
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    await db.notification.updateMany({
      where: {
        toUserId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("Mark read error:", err);
    return new Response(JSON.stringify({ error: "Failed to mark notifications" }), { status: 500 });
  }
}
