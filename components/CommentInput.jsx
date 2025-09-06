"use client";
import React from "react";
import { useUser } from "@clerk/nextjs";
import { Icon } from "@iconify/react";
import { Button, Flex, Input } from "antd";
import Avatar from "antd/es/avatar/avatar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

const CommentInput = ({ queryId, postId, parentId = null, parentAuthor = null, onCancelReply, onReplyAdded }) => {
  const { user } = useUser();
  const [value, setValue] = React.useState("");
  const queryClient = useQueryClient();

  const { isPending, mutate } = useMutation({
    mutationFn: async (commentText) => {
      if (!user) { console.log("User not found, cannot comment"); return; }
      if (!postId) {
        console.log("Post ID is required to comment");
        return;
      }
      console.log("Creating comment:", { postId, commentText, userId: user?.id, parentId });
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          commentText,
          userId: user.id,
          parentId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || "Comment API failed");
      }

      const data = await res.json();
      return data;
    },

    // CommentInput.jsx
// ...
onMutate: async (commentText) => {
    const tempId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Cancel queries
    await queryClient.cancelQueries({ queryKey: ['comments', postId] });
    await queryClient.cancelQueries({ queryKey: ['post', postId] });
    if (parentId) {
      await queryClient.cancelQueries({ queryKey: ['replies', parentId] });
    }

    // Snapshot previous data
    const previousData = {
      comments: queryClient.getQueryData(['comments', postId]),
      post: queryClient.getQueryData(['post', postId]),
      replies: parentId ? queryClient.getQueryData(['replies', parentId]) : null,
      posts: queryClient.getQueryData(queryId),
    };

    const newComment = {
      id: tempId,
      comment: commentText,
      authorId: user.id,
      author: {
        first_name: user.firstName,
        last_name: user.lastName,
        image_url: user.imageUrl,
        username: user.username || user.firstName?.toLowerCase(),
      },
      parentId,
      createdAt: new Date().toISOString(),
      Like: [],
      _count: { replies: 0, Like: 0 },
      pending: true,
    };

    // 1. Optimistically update the single `post` query (for modals).
    queryClient.setQueryData(['post', postId], (old) => {
      if (!old) return old;
      const updatedComments = [newComment, ...(old.comments || [])];
      return {
        ...old,
        comments: updatedComments,
        _count: {
          ...old._count,
          comments: (old._count?.comments || 0) + 1,
        },
      };
    });

    if (parentId) {
      // 2. Add the reply to the immediate parent's replies cache.
      queryClient.setQueryData(['replies', parentId], (old) => {
        if (!old || !old.pages) {
          return {
            pages: [{
              comments: [newComment],
              pagination: { page: 1, limit: 5, total: 1, hasMore: false }
            }],
            pageParams: [1]
          };
        }

        const updatedFirstPage = {
          ...old.pages[0],
          comments: [newComment, ...(old.pages[0]?.comments || [])],
          pagination: {
            ...old.pages[0].pagination,
            total: (old.pages[0].pagination?.total || 0) + 1
          }
        };

        return {
          ...old,
          pages: [updatedFirstPage, ...old.pages.slice(1)]
        };
      });

      // 3. Increment the reply count on the parent comment in its own cache.
      // We must find the parent comment's cache, which could be the main comments query or another replies query.
      // The most reliable way is to find the parent comment and update its _count.replies.

      // Try to update the parent in the main 'comments' query
      queryClient.setQueryData(['comments', postId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            comments: page.comments.map(comment => {
              if (comment.id === parentId) {
                return {
                  ...comment,
                  _count: {
                    ...comment._count,
                    replies: (comment._count?.replies || 0) + 1
                  }
                };
              }
              return comment;
            })
          }))
        };
      });

      // Also try to update the parent in a potential 'replies' query (for deeply nested replies)
      const repliesQueryKeys = queryClient.getQueriesData({ queryKey: ['replies'] });
      repliesQueryKeys.forEach(([key, value]) => {
        queryClient.setQueryData(key, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              comments: page.comments.map(comment => {
                if (comment.id === parentId) {
                  return {
                    ...comment,
                    _count: {
                      ...comment._count,
                      replies: (comment._count?.replies || 0) + 1
                    }
                  };
                }
                return comment;
              })
            }))
          };
        });
      });

    } else {
      // This is for a top-level comment
      queryClient.setQueryData(['comments', postId], (old) => {
        const oldPages = old?.pages || [{ comments: [], pagination: {} }];
        const updatedFirstPage = {
          ...oldPages[0],
          comments: [newComment, ...oldPages[0].comments],
          pagination: {
            ...oldPages[0].pagination,
            total: (oldPages[0].pagination?.total || 0) + 1,
          },
        };
        return { pages: [updatedFirstPage, ...oldPages.slice(1)], pageParams: old?.pageParams || [1] };
      });
    }

    // Set value and trigger callback
    setValue("");
    if (onCancelReply) onCancelReply();
    if (parentId && onReplyAdded) {
      onReplyAdded();
    }

    return { previousData, tempId };
  },

// ... rest of the component

    onError: (err, variables, context) => {
      // Rollback the cache using the snapshot taken onMutate
      if (context?.previousData) {
        queryClient.setQueryData(['comments', postId], context.previousData.comments);
        queryClient.setQueryData(['post', postId], context.previousData.post);
        queryClient.setQueryData(queryId, context.previousData.posts);
        if (parentId) {
          queryClient.setQueryData(['replies', parentId], context.previousData.replies);
        }
      }
      toast.error("Failed to comment");
      console.error("Error creating comment:", err);
    },

    onSuccess: (serverComment, variables, context) => {
      toast.success("Comment added!");
      const { tempId } = context;

      // 🌟 CORRECTED: We now invalidate the cache to trigger a clean refetch.
      // This is the most reliable way to sync with the server.
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });

      // We only invalidate the replies query if it exists.
      if (parentId) {
        queryClient.invalidateQueries({ queryKey: ['replies', parentId] });
      }

      setValue("");
      if (onCancelReply) onCancelReply();
    },
  });

  const handleSubmit = React.useCallback(() => {
    if (!value.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }
    mutate(value.trim());
  }, [value, mutate]);

  const handleKeyPress = React.useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <Flex gap="1rem" align="center">
      <Avatar src={user?.imageUrl} size={30} style={{ minWidth: "30px" }} />
      <Input.TextArea
        variant="borderless"
        placeholder={parentId ? `Reply to ${parentAuthor}` : "Comment..."}
        autoSize={{ minRows: 1, maxRows: 5 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyPress}
      />
      <Button
        type="primary"
        onClick={handleSubmit}
        disabled={isPending || !value.trim()}
        loading={isPending}
      >
        <Icon icon="iconamoon:send-fill" width="1rem" />
      </Button>
      {parentId && onCancelReply && (
        <Button type="text" onClick={onCancelReply} disabled={isPending}>
          Cancel
        </Button>
      )}
    </Flex>
  );
};

export default CommentInput;