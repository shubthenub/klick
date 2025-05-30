import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { createOrGetChat } from "@/lib/createOrGetChat";
import { createClient } from "@supabase/supabase-js";
import Pusher from "pusher";

const publicKey = process.env.CLERK_PEM_PUBLIC_KEY.replace(/\\n/g, '\n');
console.log(publicKey)

const permittedOrigins = [
  'http://localhost:3000',
  'https://cheaply-touching-clam.ngrok-free.app',
  'https://klicktest.loophole.site',
  'https://klick-one.vercel.app'
];

function verifyClerkToken(token) {
  if (!token) throw new Error("No token provided");
  const options = { algorithms: ['RS256'] };
  const decoded = jwt.verify(token, publicKey, options);

  const currentTime = Math.floor(Date.now() / 1000);
  if (decoded.exp < currentTime) throw new Error("Token expired");
  if (decoded.nbf && decoded.nbf > currentTime) throw new Error("Token not active yet");

  if (decoded.azp && !permittedOrigins.includes(decoded.azp)) {
    console.warn(`Warning: azp claim '${decoded.azp}' not in permitted origins`);
  }

  return decoded;
}

function getSupabaseWithToken(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

export async function GET(req, { params }) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const decodedToken = verifyClerkToken(token);
    const userId = decodedToken.sub;
    const supabase = getSupabaseWithToken(token);
    const { followerId: otherUserId } = await params;

    const chat = await createOrGetChat(userId, otherUserId);
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ chat, messages });
  } catch (error) {
    console.error("GET /api/messages error:", error.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req, { params }) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const decodedToken = verifyClerkToken(token);
    const userId = decodedToken.sub;
    const supabase = getSupabaseWithToken(token);
    const { followerId: otherUserId } = await params;
    const body = await req.json();

    if (!body?.content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const chat = await createOrGetChat(userId, otherUserId);
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: userId,
        content: body.content,
      },
    });

    const { error } = await supabase.from("messages").insert([message]);
    if (error) {
      console.error("Supabase insert error:", error);
    }

    const pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      useTLS: true,
    });

    await pusher.trigger(`private-chat-${chat.id}`, 'new-message', {
      message,
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("POST /api/messages error:", error.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}