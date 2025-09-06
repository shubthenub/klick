'use client';

import { useMemo } from 'react';
import { useQuery, useQueries, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { getAllFollowersAndFollowingInfo, getUser } from '@/actions/user';

// Hook for fetching followers list (lazy loading with cursor)
export const useFollowers = (userId, limit = 15) => {
  return useInfiniteQuery({
    queryKey: ['followers', userId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!userId) return { followers: [], nextCursor: null };
      const data = await getAllFollowersAndFollowingInfo(userId, {
        cursor: pageParam,
        limit,
        followers: true,
        following: false,
      });
      return {
        followers: data.followers,
        nextCursor: data.nextCursorFollowers,
      };
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    cacheTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });
};

// Hook for fetching chat ID by participants
export const useChatByParticipants = (participants, enabled = true) => {
  return useQuery({
    queryKey: ['chatByParticipants', participants?.sort()],
    queryFn: async () => {
      if (!participants || participants.length !== 2) return null;

      const res = await fetch('/api/findChatByParticipants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants }),
      });

      if (!res.ok) throw new Error('Failed to fetch chat');

      const data = await res.json();
      return data.chatId;
    },
    enabled: enabled && !!participants && participants.length === 2,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
};

// Hook for fetching multiple chat IDs for all followers
export const useFollowerChats = (userId, followers) => {
  return useQueries({
    queries: (followers || []).map((follower) => ({
      queryKey: ['chatByParticipants', [userId, follower.follower.id].sort()],
      queryFn: async () => {
        const res = await fetch('/api/findChatByParticipants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participants: [userId, follower.follower.id] }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        return {
          followerId: follower.follower.id,
          chatId: data.chatId,
        };
      },
      enabled: !!userId && !!follower.follower.id,
      staleTime: 1000 * 60 * 10,
      cacheTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    })),
  });
};

// Hook for fetching user details
export const useUserDetails = (userId) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) return null;
      const data = await getUser(userId);
      return data?.data || null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
};

// Hook for fetching multiple user details
export const useMultipleUserDetails = (userIds) => {
  return useQueries({
    queries: (userIds || []).map((userId) => ({
      queryKey: ['user', userId],
      queryFn: async () => {
        const data = await getUser(userId);
        return data?.data || null;
      },
      enabled: !!userId,
      staleTime: 1000 * 60 * 10,
      cacheTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    })),
  });
};

// Combined hook for layout data
export const useMessagesLayoutData = (userId) => {
  const queryClient = useQueryClient();

  // Followers (lazy-loaded)
  const {
    data: followersData,
    isLoading: isLoadingFollowers,
    error: followersError,
  } = useFollowers(userId);

  const followers = followersData?.pages.flatMap((p) => p.followers) || [];

  // Chat IDs for followers
  const chatQueries = useFollowerChats(userId, followers);
  const isLoadingChats = chatQueries.some((query) => query.isLoading);
  const chatErrors = chatQueries.filter((query) => query.error);

  // Build map of followerId → chatId
  const chatIdsByFollower = chatQueries.reduce((acc, query) => {
    if (query.data?.chatId && query.data?.followerId) {
      acc[query.data.followerId] = query.data.chatId;
    }
    return acc;
  }, {});

  const getChatId = (followerId) => chatIdsByFollower[followerId] || null;

  const getCachedUserDetails = (userId) =>
    queryClient.getQueryData(['user', userId]);

  const prefetchUserDetails = (userId) => {
    queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: async () => {
        const data = await getUser(userId);
        return data?.data || null;
      },
      staleTime: 1000 * 60 * 10,
    });
  };

  return {
    followers,
    chatIdsByFollower,
    isLoadingFollowers,
    isLoadingChats,
    isLoading: isLoadingFollowers || isLoadingChats,
    followersError,
    chatErrors,
    hasErrors: !!followersError || chatErrors.length > 0,
    getChatId,
    getCachedUserDetails,
    prefetchUserDetails,
  };
};

// Search filter hook
export const useSearchFollowers = (searchQuery, followers) => {
  return useMemo(() => {
    if (!searchQuery || !followers) return followers;

    const query = searchQuery.toLowerCase();
    return followers.filter(({ follower }) =>
      follower.username?.toLowerCase().includes(query) ||
      follower.first_name?.toLowerCase().includes(query) ||
      follower.last_name?.toLowerCase().includes(query)
    );
  }, [searchQuery, followers]);
};
