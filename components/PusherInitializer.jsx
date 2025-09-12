"use client";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useContext } from "react";
import { SettingsContext } from "@/context/settings/settings-context";
import { initializePusher } from "@/utils/initializePusher";
import { useUser } from "@clerk/nextjs";

const PusherInitializer = () => {
  const { user, isLoaded } = useUser(); // Add isLoaded check
  const { pusherClient, setPusherClient, setOnlineUsers, setNotificationChannel, setUserChannel } = useContext(SettingsContext);

  useEffect(() => {
    // Only initialize when user is loaded and ID is available
    if (isLoaded && user?.id && !pusherClient) {
      console.log("Initializing Pusher with userId:", user.id);
      initializePusher({ 
        setPusherClient, 
        setOnlineUsers, 
        setNotificationChannel, 
        setUserChannel, 
        userId: user.id 
      });
    }

    return () => {
      if (pusherClient) {
        pusherClient.disconnect();
        setPusherClient(null);
      }
    };
  }, [isLoaded, user?.id, pusherClient]); // Add proper dependencies

  return null;
};

export default PusherInitializer;