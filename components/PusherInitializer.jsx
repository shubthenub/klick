"use client";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useContext } from "react";
import { SettingsContext } from "@/context/settings/settings-context";
import { initializePusher } from "@/utils/initializePusher";

const PusherInitializer = () => {
  const { pusherClient, setPusherClient, setOnlineUsers } = useContext(SettingsContext);
  // const { getToken } = useAuth();

  useEffect(() => {
    initializePusher({ setPusherClient, setOnlineUsers });

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

