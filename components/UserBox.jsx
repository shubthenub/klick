"use client";
import React, { useEffect, useState } from "react";
import css from "@/styles/userBox.module.css";
import Box from "./Box/Box";
import { Avatar, Button, Flex, Typography } from "antd";
import { Icon } from "@iconify/react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFollow } from "@/actions/user";
import toast from "react-hot-toast";

/**
 * UserBox Component - User ka card jo follow/unfollow ka option deta hai
 * 
 * @param {Object} props - Component ke props
 * @param {Object} props.data - User ki details
 * @param {string} props.type - 'follower' ya 'following'
 * @param {Object} props.loggedInUserData - Current logged-in user ki info
 */
const UserBox = ({ data, type, loggedInUserData }) => {
  const [followed, setFollowed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();
  
  // ✅ Fix data access to handle both structures
  const userData = data?.[type] || data; // Handle both nested and direct structures
  const personId = userData?.id || data?.[type === "follower" ? "followerId" : "followingId"];

  // ✅ Add debug logging to see the actual structure
  console.log("UserBox Debug:", {
    type,
    data,
    userData,
    personId,
    dataKeys: data ? Object.keys(data) : null
  });

  useEffect(() => {
    const followingIds = loggedInUserData?.following?.map(person => person?.followingId) || [];
    
    // ✅ Use the correct ID for checking follow status
    const targetId = userData?.id || data?.[type === "follower" ? "followerId" : "followingId"];
    const isFollowing = followingIds.includes(targetId);
    
    setFollowed(isFollowing);
  }, [loggedInUserData, data, type, userData]);

  const { mutate } = useMutation({
    mutationFn: updateFollow,

    onMutate: async (params) => {
      setIsProcessing(true);
      
      await queryClient.cancelQueries(["user", currentUser?.id, "followInfo"]);
      await queryClient.cancelQueries(["user", personId, "followInfo"]);

      queryClient.setQueryData(
        ["user", currentUser?.id, "followInfo"],
        (old) => {
          const newFollowing = params?.type === "follow"
            ? [
                ...(old?.following || []),
                {
                  followingId: params.id,
                  followerId: currentUser?.id,
                  following: userData, // ✅ Use userData instead of data[type]
                },
              ]
            : (old?.following || []).filter(
                person => person.followingId !== params.id
              );

          return {
            ...old,
            following: newFollowing,
          };
        }
      );

      setFollowed(params?.type === "follow");
      return { previousFollowStatus: followed };
    },

    onError: (err, variables, context) => {
      toast.error("Kuch gadbad ho gaya. Phir se try karo!");
      console.error("Follow error:", err);
      setFollowed(context.previousFollowStatus);
    },

    onSettled: () => {
      setIsProcessing(false);
      
      queryClient.invalidateQueries({
        queryKey: ["user", currentUser?.id, "followInfo"],
        refetchType: 'active',
      });
      
      queryClient.invalidateQueries({
        queryKey: ["user", "followSuggestions"],
        refetchType: 'inactive',
      });
    },
  });

  // ✅ Fix button disable condition
  const isButtonDisabled = isProcessing || personId === currentUser?.id;

  // ✅ If no valid user data, don't render
  if (!userData || !personId) {
    console.warn("UserBox: No valid user data", { data, type, userData, personId });
    return null;
  }

  return (
    <Box className={css.container}>
      <div className={css.left}>
        <Avatar src={userData?.image_url} size={40} />
        <div className={css.details}>
          <Typography.Text className={"typoSubtitle2"} ellipsis>
            {userData?.first_name} {userData?.last_name}
          </Typography.Text>
          <Typography.Text className={"typoCaption"} type="secondary">
            @{userData?.username}
          </Typography.Text>
        </div>
      </div>

      {!isButtonDisabled && (
        <div className={css.right}>
          {!followed ? (
            <Button
              onClick={() => mutate({ 
                id: personId, 
                type: "follow",
                userId: currentUser?.id
              })}
              className={css.button}
              type="text"
              size="small"
              loading={isProcessing}
              disabled={isProcessing}
            >
              <Typography.Text strong>Follow</Typography.Text>
            </Button>
          ) : (
            <Button
              type="text"
              size="small"
              onClick={() => mutate({
                id: personId,
                type: "unfollow",
                userId: currentUser?.id
              })}
              loading={isProcessing}
              disabled={isProcessing}
            >
              <Flex gap={10} align="center">
                <Icon icon={"charm:tick"} width={18} color="#3db66a" />
                <Typography.Text strong style={{ color: "#3db66a" }}>
                  Followed
                </Typography.Text>
              </Flex>
            </Button>
          )}
        </div>
      )}
    </Box>
  );
};
export default UserBox;