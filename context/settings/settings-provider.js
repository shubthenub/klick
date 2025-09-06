'use client';
import React, { useRef, useState } from 'react';
import { SettingsContext } from './settings-context';

export const SettingsContextProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    theme: 'dark',
    isSidebarOpen: false,
    isMiniSidebar: false,
  });

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [pusherClient, setPusherClient] = useState(null);

  // Add lastMessages state here
  const [lastMessages, setLastMessages] = useState({});

  // A helper function to update last message for a specific chat
  const updateLastMessage = (chatId, message) => {
    setLastMessages((prev) => ({
      ...prev,
      [chatId]: message,
    }));
  };
  const [seenItems, setSeenItems] = useState(new Set());
  const [notificationChannel, setNotificationChannel] = useState(null);
  const [userChannel, setUserChannel] = useState(null);
  const markSeen = async (id) => {
    setSeenItems((prev) => new Set(prev).add(id));
  };

  // 🔥 Post Modal state
  const [postModalId, setPostModalId] = useState(null);
  const openPostModal = (id) => setPostModalId(id);
  const closePostModal = () => setPostModalId(null);
  const dmChannelsRef = useRef({}); // For Pusher channels
  const [chatIdMap, setChatIdMap] = useState({});

  const contextValue = {
    settings,
    setSettings,
    pusherClient,
    setPusherClient,
    onlineUsers,
    setOnlineUsers,
    lastMessages,
    setLastMessages,
    updateLastMessage,  // expose helper as well
    seenItems,
    setSeenItems,
    markSeen, // expose markSeen function
    notificationChannel,
    setNotificationChannel,
    userChannel,
    setUserChannel,
    postModalId,
    openPostModal,
    closePostModal,
    dmChannelsRef,
    chatIdMap,
    setChatIdMap,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};
