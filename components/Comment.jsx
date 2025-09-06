"use client";
import { SettingsContext } from "@/context/settings/settings-context";
import React, { useContext, useEffect, useState} from "react";
import { Avatar, Flex, Typography, Button, Spin, } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { Icon } from "@iconify/react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import css from "@/styles/post.module.css";
import cx from "classnames";
import CommentInput from "./CommentInput";
import LikeButton from "./LikeButton";
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from "@clerk/nextjs";
import { MdDelete } from "react-icons/md";
import toast from "react-hot-toast";

dayjs.extend(relativeTime);

const Comment = ({
  data,
  queryId,
  postId,
  setReplyingTo,
  replyingTo,
  depth = 0,
  hideRepliesInitially = false,
}) => {
  const {
    pusherClient,
    settings: { theme },
  } = useContext(SettingsContext);

  const [showReplies, setShowReplies] = useState(false);
  const isReplying = replyingTo === data.id;
  const queryClient = useQueryClient();
  const [isHovered, setIsHovered] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  React.useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

  React.useEffect(() => {
    if (depth > 0 && !hideRepliesInitially) {
      setShowReplies(true);
    }
  }, [depth, hideRepliesInitially]);

  const getParentUsername = () => {
    if (!data.parentId) return null;
    
    // First, try to find the parent comment in the main comments cache
    const commentsData = queryClient.getQueryData(['comments', postId]);
    if (commentsData?.pages) {
      const allComments = commentsData.pages.flatMap(page => page?.comments || []);
      const parentComment = allComments.find(c => c.id === data.parentId);
      if (parentComment?.author?.username) {
        return parentComment.author.username;
      }
    }
    
    // For nested replies, search through all possible replies caches
    if (commentsData?.pages) {
      const allComments = commentsData.pages.flatMap(page => page?.comments || []);
      
      // Check each top-level comment's replies cache
      for (const topLevelComment of allComments) {
        const repliesData = queryClient.getQueryData(['replies', topLevelComment.id]);
        if (repliesData?.pages) {
          const allReplies = repliesData.pages.flatMap(page => page?.comments || []);
          const parentComment = allReplies.find(c => c.id === data.parentId);
          if (parentComment?.author?.username) {
            return parentComment.author.username;
          }
        }
      }
    }
    
    // Also check if there's a direct replies cache for the parent
    const directParentReplies = queryClient.getQueryData(['replies', data.parentId]);
    if (directParentReplies?.pages) {
      // This won't find the parent itself, but might be useful for future lookups
      const allReplies = directParentReplies.pages.flatMap(page => page?.comments || []);
      const parentComment = allReplies.find(c => c.id === data.parentId);
      if (parentComment?.author?.username) {
        return parentComment.author.username;
      }
    }
    
    return null;
  };

  // const parentUsername = getParentUsername();
  const parentUsername = data.parent?.author?.username || null
  
  const totalRepliesCount = data._count?.replies || 0;

  const {
    data: repliesData,
    fetchNextPage: fetchNextReplies,
    hasNextPage: hasMoreReplies,
    isFetchingNextPage: isLoadingMoreReplies,
    isLoading: isLoadingReplies,
  } = useInfiniteQuery({
    queryKey: ['replies', data.id],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(`/api/comment/${postId}?page=${pageParam}&limit=5&parentId=${data.id}`);
      if (!response.ok) throw new Error('Failed to fetch replies');
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.pagination) return undefined;
      return lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined;
    },
    enabled: showReplies,
    staleTime: 1000 * 60 * 5,
  });

  const allReplies = React.useMemo(() => {
    return Array.isArray(repliesData?.pages)
      ? repliesData.pages.flatMap(page => page?.comments || [])
      : [];
  }, [repliesData?.pages]);

  const handleShowReplies = React.useCallback(() => {
    setShowReplies(prev => !prev);
  }, []);

  const { user } = useUser();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDeleteComment = React.useCallback(async () => {
    if (!isMounted) return;
    setIsDeleting(true);

    const previousCommentsData = queryClient.getQueryData(['comments', postId]);
    const previousPostsData = queryClient.getQueryData(queryId);
    const previousPostModalData = queryClient.getQueryData(['post', postId]);

    try {
      const res = await fetch("/api/comment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId: data.id,
          userId: user.id,
        }),
      });

      if (res.ok) {
        queryClient.setQueryData(['comments', postId], oldData => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map(page => ({
              ...page,
              comments: page.comments.filter(c => c.id !== data.id)
            }))
          };
        });

        queryClient.setQueryData(queryId, oldData => {
          if (!oldData) return oldData;
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map(page => ({
                ...page,
                data: page.data.map(post =>
                  post.id === postId
                    ? { ...post, comments: post.comments.filter(c => c.id !== data.id) }
                    : post
                )
              }))
            };
          }
          return {
            ...oldData,
            comments: oldData.comments?.filter(c => c.id !== data.id) || []
          };
        });

        queryClient.setQueryData(['post', postId], oldData => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            comments: oldData.comments?.filter(c => c.id !== data.id) || []
          };
        });

        if (data.parentId) {
          queryClient.setQueryData(['replies', data.parentId], oldData => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map(page => ({
                ...page,
                comments: page.comments.filter(c => c.id !== data.id)
              }))
            };
          });
        }
        if (isMounted) setIsDeleting(false);
        setTimeout(() => {
          if (isMounted) toast.success("Comment deleted");
        }, 1000);
      } else {
        throw new Error("Delete failed");
      }
    } catch (error) {
      queryClient.setQueryData(['comments', postId], previousCommentsData);
      queryClient.setQueryData(queryId, previousPostsData);
      queryClient.setQueryData(['post', postId], previousPostModalData);

      if (isMounted) {
        setIsDeleting(false);
        toast.error("Failed to delete comment");
      }
      console.error("Delete comment error:", error);
    }
  }, [data.id, user.id, postId, queryId, queryClient, data.parentId, isMounted]);
  
  const handleReplyAdded = () => {
    setShowReplies(true);
  };

  const isPending = data.pending
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        opacity: isPending ? 0.5 : 1,
        pointerEvents: isPending ? "none" : "auto",
        transition: "opacity 0.3s"
      }}
    >
      <Flex align="center" style={{ gap: "0.75rem", padding: "0.5rem 0" }}>
        <Avatar size={30} src={data?.author?.image_url} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, }}>
              {data.author?.username}
              {data.author?.isVerified && (
                <Icon icon="mdi:check-decagram" color="#4cc36a" style={{ marginLeft: 4, verticalAlign: "middle" }} />
              )}
            </span>
            {parentUsername && (
              <span style={{ fontWeight: 500, marginLeft: 4 }}>
                @{parentUsername}
              </span>
            )}
            <span style={{ fontWeight: 400, marginLeft: 8, wordBreak: "break-word" }}>
              {data.comment}
            </span>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", marginTop: 2, fontSize: 12 }}>
            <span style={{ color: "#aaa" }}>{dayjs(data?.createdAt).fromNow(true)}</span>
            <span
              style={{ color: "#aaa", cursor: "pointer", display: (totalRepliesCount === 0 || repliesData?.pages?.length > 0) ? "block" : "none" }}
              onClick={() => setReplyingTo(isReplying ? null : data.id)}
            >
              Reply
            </span>
            {user?.id === data.authorId && isHovered && (
              <span
                style={{ color: "#e74c3c", cursor: "pointer", display: "flex", alignItems: "center", fontSize: "0.9rem", onHover: { color: "#ffffffff" } }}
                onClick={handleDeleteComment}
              >
                {isDeleting ? (
                  <Spin indicator={<LoadingOutlined style={{ color: "#e74c3c" }} />} />
                ) : (
                  <MdDelete />
                )}
              </span>
            )}
          </div>
        </div>

        <LikeButton
          type="COMMENT"
          targetId={data.id}
          existingLikes={data.Like || []}
          queryKey={["comments", postId]}
          showCount={true}
          size="sm"
        />
      </Flex>

      {isReplying && (
        <div style={{ marginLeft: depth === 0 ? "2.5rem" : "0", marginTop: "0.5rem" }}>
          <CommentInput
            postId={postId}
            queryId={queryId}
            parentId={data.id}
            parentAuthor={data?.author?.username}
            onCancelReply={() => setReplyingTo(null)}
            onReplyAdded={handleReplyAdded}
          />
        </div>
      )}

      {(totalRepliesCount > 0 ) && (
        <div style={{ marginLeft: "2.5rem",  }}>
          <Button
            type="text"
            onClick={handleShowReplies}
            loading={isLoadingReplies}
            style={{
              padding: "0.25rem 0",
              marginBottom: "0.5rem",
              height: "auto",
              fontSize: "0.85rem",
              color: theme === "dark" ? "#aaa" : "#666",
            }}
          >
            {showReplies ? "Hide" : "View"} {totalRepliesCount} {totalRepliesCount === 1 ? "reply" : "replies"}
          </Button>
        </div>
      )}

      {showReplies && (
        <div style={{ marginLeft: depth === 0 ? "2.5rem" : "0",  }}>
          {allReplies.map((reply) => (
            <Comment
              key={reply.id}
              data={reply}
              postId={postId}
              queryId={queryId}
              setReplyingTo={setReplyingTo}
              replyingTo={replyingTo}
              depth={depth + 1}
              hideRepliesInitially={true}
            />
          ))}
          {hasMoreReplies && (
            <Button
              type="text"
              onClick={() => fetchNextReplies()}
              loading={isLoadingMoreReplies}
              style={{
                marginTop: "0.5rem",
                fontSize: "0.8rem",
                color: theme === "dark" ? "#aaa" : "#666",
              }}
            >
              Load more replies
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Comment;