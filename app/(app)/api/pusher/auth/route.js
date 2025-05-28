import { NextResponse } from 'next/server';
import Pusher from 'pusher';
import jwt from 'jsonwebtoken';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

const permittedOrigins = [
  'http://localhost:3000',
  'https://cheaply-touching-clam.ngrok-free.app',
  'https://klicktest.loophole.site'
];

function verifyClerkToken(token) {
  if (!token) throw new Error("No token provided");
  const publicKey = process.env.CLERK_PEM_PUBLIC_KEY;
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

export async function POST(req) {
  try {
    const formData = await req.formData();
    const socket_id = formData.get('socket_id');
    const channel_name = formData.get('channel_name');

    if (!socket_id || !channel_name) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decodedToken = verifyClerkToken(token);
    const userId = decodedToken.sub;

    const authResponse = pusher.authorizeChannel(socket_id, channel_name, {
      user_id: userId,
      user_info: { name: userId },
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed', details: error.message },
      { status: 403 }
    );
  }
}