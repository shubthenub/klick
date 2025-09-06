'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';

// Hook for fetching last messages
export const useLastMessages = () => {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['lastMessages', userId],
    queryFn: async () => {
      if (!userId) return {};
      
      const res = await fetch('/api/chats/last-messages', {
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch last messages');
      }
      
      const data = await res.json();
      return data.lastMessages || {};
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    cacheTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook for managing last messages with real-time updates
export const useLastMessagesManager = () => {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  // Function to update last message for a specific chat
  const updateLastMessage = (chatId, message) => {
    queryClient.setQueryData(['lastMessages', userId], (old) => {
      if (!old) return { [chatId]: message };
      
      return {
        ...old,
        [chatId]: message,
      };
    });
  };

  // Function to get cached last message for a chat
  const getLastMessage = (chatId) => {
    const lastMessages = queryClient.getQueryData(['lastMessages', userId]);
    return lastMessages?.[chatId] || null;
  };

  return {
    updateLastMessage,
    getLastMessage,
  };
};

// Hook for fetching unread counts
export const useUnreadCounts = () => {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['unreadCounts', userId],
    queryFn: async () => {
      if (!userId) return {};
      
      const res = await fetch('/api/chats/unread-counts', {
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch unread counts');
      }
      
      const data = await res.json();
      return data.unreadCounts || {};
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 1, // 1 minute
    cacheTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Hook for managing unread counts with real-time updates
export const useUnreadCountsManager = () => {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  // Function to decrement unread count for a specific chat
  const decrementUnreadCount = (chatId, amount = 1) => {
    queryClient.setQueryData(['unreadCounts', userId], (old) => {
      if (!old) return {};
      
      const currentCount = old[chatId] || 0;
      const newCount = Math.max(0, currentCount - amount);
      
      return {
        ...old,
        [chatId]: newCount,
      };
    });
  };

  // Function to increment unread count for a specific chat
  const incrementUnreadCount = (chatId, amount = 1) => {
    queryClient.setQueryData(['unreadCounts', userId], (old) => {
      if (!old) return { [chatId]: amount };
      
      const currentCount = old[chatId] || 0;
      
      return {
        ...old,
        [chatId]: currentCount + amount,
      };
    });
  };

  // Function to reset unread count for a specific chat
  const resetUnreadCount = (chatId) => {
    queryClient.setQueryData(['unreadCounts', userId], (old) => {
      if (!old) return {};
      
      return {
        ...old,
        [chatId]: 0,
      };
    });
  };

  // Function to get cached unread count for a chat
  const getUnreadCount = (chatId) => {
    const unreadCounts = queryClient.getQueryData(['unreadCounts', userId]);
    return unreadCounts?.[chatId] || 0;
  };

  return {
    decrementUnreadCount,
    incrementUnreadCount,
    resetUnreadCount,
    getUnreadCount,
  };
};
