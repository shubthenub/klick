import Pusher from "pusher-js";
import {auth} from "@clerk/nextjs";

export const initializePusher = async ({ setPusherClient, setOnlineUsers, setNotificationChannel, setUserChannel, userId }) => {
  const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    authEndpoint: "/api/pusher/auth",
    auth: {
      credentials: "include", // Send Clerk cookies instead of token
    },
    forceTLS: true,
  });


  const channel = pusher.subscribe("presence-chat");
  const NotificationChannel= pusher.subscribe(`notification-${userId}`);
  const userChannel = pusher.subscribe(`private-user-${userId}`);
  console.log("subscribed to private user channel", `private-user-${userId}`)
  console.log(`Subscribed to notification channel: notification-${userId}`);
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
  setNotificationChannel(NotificationChannel);
  setUserChannel(userChannel);
  return pusher;
};
