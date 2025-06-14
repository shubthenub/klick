import Pusher from "pusher-js";

export const initializePusher = async ({ setPusherClient, setOnlineUsers }) => {
  const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    authEndpoint: "/api/pusher/auth",
    auth: {
      credentials: "include", // Send Clerk cookies instead of token
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
  return pusher;
};
