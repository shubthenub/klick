"use client";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useContext } from "react";
import { SettingsContext } from "@/context/settings/settings-context";
import { initializePusher } from "@/utils/initializePusher";
import { useUser } from "@clerk/nextjs";

const PusherInitializer = () => {
  const { user } = useUser();
  const { pusherClient, setPusherClient, setOnlineUsers, setNotificationChannel, setUserChannel } = useContext(SettingsContext);
  // const { getToken } = useAuth();

  useEffect(() => {
    initializePusher({ setPusherClient, setOnlineUsers, setNotificationChannel, setUserChannel, userId: user?.id });

    return () => {
      if (pusherClient) {
        pusherClient.disconnect();
        setPusherClient(null);
      }
    };
  }, []);

  return null;
};

export default PusherInitializer;

