'use client';
import React, { useState } from 'react';
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

  const markSeen = async (id) => {
    setSeenItems((prev) => new Set(prev).add(id));
  };

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
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};
