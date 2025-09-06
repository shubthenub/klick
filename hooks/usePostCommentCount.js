// hooks/usePostCommentCount.js

import { useQueryClient } from '@tanstack/react-query';

export const usePostCommentCount = (postId) => {
  const queryClient = useQueryClient();
  const post = queryClient.getQueryData(['post', postId]);
  
  // This hook provides the real-time, optimistic count from the
  // single post cache, which is what we need.
  return post?._count?.comments;
};