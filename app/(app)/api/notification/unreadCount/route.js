// app/api/notification/unreadCount/route.js
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response(JSON.stringify({ count: 0 }));

  const count = await db.notification.count({
    where: { toUserId: userId, isRead: false },
  });

  return new Response(JSON.stringify({ count }));
}
