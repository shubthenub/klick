"use client";
import { useUser } from "@clerk/nextjs";
import { Icon } from "@iconify/react";
import { Button, Flex, Typography } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const LikeButton = ({
  targetId,
  type,
  existingLikes = [],
  queryKey,
  showCount = true,
  size = "md",
  followerId=null,
  likes=[],
  entityId=null,
}) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(() => {
    if (showCount) {
      return existingLikes?.some((like) => like.authorId === user?.id) || false;
    } else {
      return existingLikes && existingLikes.length > 0;
    }
  });
  const [likeCount, setLikeCount] = useState(existingLikes?.length || 0);
  const [isAnimating, setIsAnimating] = useState(false);

  

  const { mutate, isPending } = useMutation({
    mutationFn: async ({ action }) => {
      console.log("Mutating like state", { targetId, userId: user?.id, type, action });
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId,
          userId: user.id,
          followerId,
          likes,
          type,
          action,
          entityId
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || "Like API failed");
      }

      return await res.json();
    },
    
    onMutate: async ({ action }) => {
       const chatId = entityId;
      console.log("Optimistically updating like state", { targetId, userId: user?.id, type, action , entityId});
      // Simple optimistic update
      if (type === "MESSAGE" && chatId && user?.id) {
    queryClient.setQueryData(["messages", chatId], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          messages: page.messages.map((msg) => {
            if (msg.id !== targetId) return msg;
            if (action === "like") {
              // Add like optimistically
              return {
                ...msg,
                Like: [...(msg.Like || []), { authorId: user.id }],
              };
            } else {
              // Remove current user's like optimistically
              return {
                ...msg,
                Like: (msg.Like || []).filter(like => like.authorId !== user.id),
              };
            }
          }),
        })),
      };
    });
  }
      const newLikeState = action === "like";
      setIsLiked(newLikeState);
      setLikeCount((prev) => (action === "like" ? prev + 1 : prev - 1));
      
    },

    onError: (err, variables) => {
      console.error("Error updating like state",err);
      // Revert optimistic update on error
      const wasLiking = variables.action === "like";
      setIsLiked(!wasLiking); // Revert to opposite of what we were trying to do
      setLikeCount((prev) => (wasLiking ? prev - 1 : prev + 1)); // Undo the count change
    },

    onSettled: () => {
      console.log("Like mutation settled", { targetId, userId: user?.id, type });
      // // Invalidate queries after 5 seconds
      // setTimeout(() => {
      //   queryClient.invalidateQueries({ queryKey: queryKey });
      //   if (type === 'COMMENT') {
      //     queryClient.invalidateQueries({ queryKey: ['comments'] });
      //   }
      // }, 5000);
    },
  });
  // No useEffect needed - let the 5-second invalidation timer be the sole source of truth
  // Initial state is set in useState() and optimistic updates handle immediate UI feedback

  const handleToggleLike = () => {
    console.log("Like button clicked", { targetId, userId: user?.id, type });
    const newLikeState = !isLiked;
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    mutate({ action: newLikeState ? "like" : "unlike" });
  };

  const iconSize = size === "sm" ? "12px" : size === "lg" ? "24px" : "20px";

  return (
    <Button
      size="small"
      onClick={handleToggleLike}
      style={{ background: "transparent", border: "none", padding: 0 }}
    >
      <Flex align="center" gap="0.3rem">
        <Icon
          icon="ph:heart-fill"
          width={iconSize}
          color={isLiked ? "var(--primary)" : "grey"}
          style={{
            transform: isAnimating ? "scale(1.2)" : "scale(1)",
            transition: "transform 0.3s ease-in-out",
          }}
        />
        {(showCount && likeCount!=0) &&  (
          <Typography.Text className="typoBody2"  style={{fontSize: size === "sm" ? "12px" : "14px",}}>
            {likeCount}
          </Typography.Text>
        )}
      </Flex>
    </Button>
  );
};

export default LikeButton;