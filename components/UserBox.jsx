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
  // State variables
  const [followed, setFollowed] = useState(false); // Follow status track karne ke liye
  const [isProcessing, setIsProcessing] = useState(false); // Loading state
  
  // Hooks initialization
  const { user: currentUser } = useUser(); // Current user nikalne ke liye
  const queryClient = useQueryClient(); // Query client for data management
  
  // User ID nikal rahe hai
  const personId = data?.[type]?.id;

  /**
   * Effect jo follow status check karta hai
   * Jab bhi loggedInUserData, data ya type change hota hai
   */
  useEffect(() => {
    // Current user ke following IDs nikal rahe hai
    const followingIds = loggedInUserData?.following?.map(person => person?.followingId) || [];
    
    // Check karte hai ki yeh user followed hai ya nahi
    const isFollowing = followingIds.includes(
      data?.[type === "follower" ? "followerId" : "followingId"]
    );
    
    // Local state update karte hai
    setFollowed(isFollowing);
  }, [loggedInUserData, data, type]);

  /**
   * Follow/Unfollow ka mutation
   * Yahan pe OPTIMISTIC UPDATE ka magic hai
   */
  const { mutate } = useMutation({
    mutationFn: updateFollow, // API call function

    /**
     * OPTIMISTIC UPDATE WALA SECTION (Asli API call se pehle)
     * Yahan pe hum UI ko instantly update karte hai
     * Follow button -> Followed ho jata hai instantly
     * Par suggestions list mein user tab tak rahega jab tak refresh nahi karte
     */
    onMutate: async (params) => {
      setIsProcessing(true); // Loading shuru
      
      // Existing queries cancel karte hai taaki race condition na ho
      await queryClient.cancelQueries(["user", currentUser?.id, "followInfo"]);
      await queryClient.cancelQueries(["user", personId, "followInfo"]);

      /**
       * YAHAN PE ASLI OPTIMISTIC UPDATE HOTA HAI
       * Hum cache ko manually update karte hai
       * Taaki UI instantly respond kare
       */
      queryClient.setQueryData(
        ["user", currentUser?.id, "followInfo"],
        (old) => {
          // Naya following array banate hai
          const newFollowing = params?.type === "follow"
            ? [
                ...(old?.following || []), // Purane follows ke saath
                {
                  followingId: params.id, // Naya follow add karte hai
                  followerId: currentUser?.id,
                  following: data[type],
                },
              ]
            : (old?.following || []).filter(
                person => person.followingId !== params.id // Unfollow case
              );

          return {
            ...old,
            following: newFollowing, // Updated array return karte hai
          };
        }
      );

      // Local state ko bhi update karte hai
      setFollowed(params?.type === "follow");

      // Error handling ke liye previous state save karte hai
      return { previousFollowStatus: followed };
    },

    /**
     * Agar error aaya toh - optimistic update ko revert karte hai
     */
    onError: (err, variables, context) => {
      toast.error("Kuch gadbad ho gaya. Phir se try karo!");
      console.error("Follow error:", err);
      // Wapas previous state pe set karte hai
      setFollowed(context.previousFollowStatus);
    },

    /**
     * REFRESH/REVALIDATION WALA SECTION
     * API call complete hone ke baad
     * Yahan pe hum decide karte hai ki kya refresh karna hai
     */
    onSettled: () => {
      setIsProcessing(false); // Loading khatam
      
      // Current user ka follow data refresh karte hai (active queries ke liye)
      queryClient.invalidateQueries({
        queryKey: ["user", currentUser?.id, "followInfo"],
        refetchType: 'active', // Active screens pe immediately refresh
      });
      
      /**
       * SPECIAL LOGIC FOR SUGGESTIONS:
       * Hum suggestions list ko INACTIVELY invalidate karte hai
       * Matlab yeh tab refresh hoga jab:
       * - Page refresh karenge
       * - Dusre route pe jayenge aur wapas aayenge
       * Isse suggestions list mein user abhi bhi dikhega
       * Lekin "Followed" state dikhayega
       */
      queryClient.invalidateQueries({
        queryKey: ["user", "followSuggestions"],
        refetchType: 'inactive', // Next refresh tak wait karega
      });
    },
  });

  // Button disable conditions
  const isButtonDisabled = isProcessing || data?.[type]?.id === currentUser?.id;

  return (
    <Box className={css.container}>
      {/* Left side - User ki photo aur details */}
      <div className={css.left}>
        <Avatar src={data?.[type]?.image_url} size={40} />
        <div className={css.details}>
          <Typography.Text className={"typoSubtitle2"} ellipsis>
            {data?.[type]?.first_name} {data?.[type]?.last_name}
          </Typography.Text>
          <Typography.Text className={"typoCaption"} type="secondary">
            @{data?.[type]?.username}
          </Typography.Text>
        </div>
      </div>

      {/* Right side - Follow button (current user ke liye nahi) */}
      {!isButtonDisabled && (
        <div className={css.right}>
          {!followed ? (
            // Follow button (abhi follow nahi hai)
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
            // Followed state (green tick wala)
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