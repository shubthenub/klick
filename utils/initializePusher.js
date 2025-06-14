import Pusher from "pusher-js";

export const initializePusher = async ({ getToken, setPusherClient, setOnlineUsers }) => {
  const token = await getToken({ skipCache: true });

  const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    authEndpoint: "/api/pusher/auth",
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    forceTLS: true,
  });

  const channel = pusher.subscribe("presence-chat");

  channel.bind("pusher:subscription_succeeded", (members) => {
    const users = [];
    members.each((member) => users.push(member.id));
    setOnlineUsers(users);
    console.log("Subscribed: online users =", users);
  });

  channel.bind("pusher:member_added", (member) => {
    setOnlineUsers((prev) => [...prev, member.id]);
  });

  channel.bind("pusher:member_removed", (member) => {
    setOnlineUsers((prev) => prev.filter((id) => id !== member.id));
  });

  setPusherClient(pusher);
  return pusher; // return in case you need it for cleanup later
};
