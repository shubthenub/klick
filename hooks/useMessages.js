'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';

// Hook for fetching messages with infinite scrolling
export const useMessages = (followerId , chatId) => {
  const { getToken } = useAuth();

  return useInfiniteQuery({
    queryKey: ['messages', chatId],
    enabled: !!chatId,
    placeholderData: undefined, // <--- This prevents showing old chat's data
    queryFn: async ({ pageParam = null }) => {
      const url = new URL(`/api/messages/${followerId}`, window.location.origin);
      url.searchParams.set('limit', '40');
      
      if (pageParam) {
        url.searchParams.set('before', pageParam);
      }

      const res = await fetch(url, { 
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch messages. Status: ${res.status}. Response: ${text}`);
      }

      const data = await res.json();
      return data;
    },
    getNextPageParam: (lastPage) => {
      // If we got less than 20 messages, there are no more pages
      if (!lastPage.messages || lastPage.messages.length <40) {
        return undefined;
      }
      // Return the ID of the oldest message for pagination (first message in the array)
      return lastPage.messages[0]?.id;
    },
    enabled: !!followerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    cacheTime: 1000 * 60 * 10, // 10 minutes
    // refetchOnWindowFocus: true,
  });
};

// Hook for sending messages
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ followerId, messageData }) => {
      const res = await fetch(`/api/messages/${followerId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to send message. Status: ${res.status}. Response: ${text}`);
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      // Don't invalidate - let Pusher handle the status update
      // queryClient.invalidateQueries(['messages', variables.followerId]);
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    },
  });
};

// Hook for optimistic message updates
export const useOptimisticMessage = (chatId) => {
  const queryClient = useQueryClient();

  const addOptimisticMessage = (message) => {
    queryClient.setQueryData(['messages', chatId], (old) => {
      if (!old) {
        // If no data exists yet, create initial structure
        return {
          pages: [{
            chat: null,
            messages: [message]
          }],
          pageParams: [null]
        };
      }

      // Create a new structure with the optimistic message
      const newPages = [...old.pages];
      if (newPages.length > 0) {
        // Add to the first page (most recent messages) at the end
        // Since we reverse pages in the component, first page has newest messages
        newPages[0] = {
          ...newPages[0],
          messages: [...newPages[0].messages, message],
        };
      } else {
        // If no pages exist, create the first page
        newPages.push({
          chat: null,
          messages: [message]
        });
      }

      return {
        ...old,
        pages: newPages,
      };
    });
  };

  const updateMessageStatus = (messageId, status, chatId) => {
    queryClient.setQueryData(['messages', chatId], (old) => {
      if (!old) return old;

      const newPages = old.pages.map((page) => ({
        ...page,
        messages: page.messages.map((msg) =>
          msg.id === messageId ? { ...msg, status } : msg
        ),
      }));

      return {
        ...old,
        pages: newPages,
      };
    });
  };

  return { addOptimisticMessage, updateMessageStatus };
};

// Utility function to get media type
export const getMediaType = (url) => {
  if (/\.(jpeg|jpg|png|gif|webp)$/i.test(url)) return 'image';
  if (/\.(mp4|webm|mov)$/i.test(url)) return 'video';
  return 'text';
};
