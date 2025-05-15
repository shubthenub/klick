import { useUser } from "@clerk/nextjs";
import { Icon } from "@iconify/react";
import { Button, Flex, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePostLike } from "@/actions/post"; // Import function

const LikeButton = ({ postId, likes }) => {
  const { user } = useUser();
  const queryClient = useQueryClient(); // ✅ Ensure queryClient is available
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes?.length || 0);
  const [isAnimating, setIsAnimating] = useState(false); // Animation state

  useEffect(() => {
    setIsLiked(likes?.some((like) => like?.authorId === user?.id));
  }, [likes, user]);

  const { mutate } = useMutation({
    mutationFn: ({ postId, actionType, userId }) => updatePostLike(postId, actionType, userId),
    onMutate: async ({ postId, actionType }) => {
      // Optimistically update UI before backend response
      await queryClient.cancelQueries(["feed"]);
  
      const previousFeed = queryClient.getQueryData(["feed"]);
  
      queryClient.setQueryData(["feed"], (oldData) => {
        if (!oldData) return oldData;
        
        return {
          ...oldData,
          data: oldData.data.map((post) => 
            post.id === postId 
              ? { ...post, likes: actionType === "like" 
                ? [...post.likes, { authorId: user.id }] 
                : post.likes.filter((like) => like.authorId !== user.id) } 
              : post
          ),
        };
      });
  
      return { previousFeed };
    },
    onError: (err, _, context) => {
      console.error("Error updating like:", err);
      if (context?.previousFeed) {
        queryClient.setQueryData(["feed"], context.previousFeed);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(["feed"]); // Ensure the UI reflects the updated data
    },
  });

  const handleLike = () => {
    if (!user || !postId) {  // Check if user or postId is missing
      console.error("User not authenticated or postId missing", { user, postId });
      return;
    }

    const newLikeStatus = !isLiked;
    setIsLiked(newLikeStatus);
    setLikeCount((prev) => (newLikeStatus ? prev + 1 : prev - 1)); // Optimistic UI update

    setIsAnimating(true); // Start animation
    setTimeout(() => setIsAnimating(false), 300); // Reset animation after 300ms

    mutate({ 
      postId, 
      actionType: newLikeStatus ? "like" : "unlike", 
      userId: user.id 
    });
  };

  return (
    <Button
      size="small"
      style={{ background: "transparent", border: "none", boxShadow: "none" }}
      onClick={handleLike}
    >
      <Flex gap="0.5rem" align="center">
        <Icon
          icon="ph:heart-fill"
          width="22px"
          color={isLiked ? "var(--primary)" : "grey"}
          style={{
            transform: isAnimating ? "scale(1.2)" : "scale(1)",
            transition: "transform 0.3s ease-in-out",
          }}
        />
        <Typography.Text className="typoBody2">
          {likeCount}
        </Typography.Text>
      </Flex>
    </Button>
  );
};

export default LikeButton;
