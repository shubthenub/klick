import React, { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllFollowersAndFollowingInfo, updateFollow , getFollowersAndFollowingIds } from "@/actions/user";
import { Alert, Button, Skeleton, Typography } from "antd";
import toast from "react-hot-toast";

const FollowButton = ({ id }) => {
  const [followed, setFollowed] = React.useState(false);
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();

  // Fixed: using useQuery instead of useQueryClient
  const { data, isLoading, isError } = useQuery({
    queryKey: ["user", currentUser?.id, "followInfo"],
    queryFn: () => getFollowersAndFollowingIds(currentUser?.id),
    enabled: !!currentUser?.id,
    staleTime: 1000 * 60 * 20,
  });

  useEffect(() => {
    if (data?.following?.map((person) => person?.followingId).includes(id)) {
      setFollowed(true);
    } else {
      setFollowed(false);
    }
  }, [data, id]);

  // Fixed: using mutationFn instead of queryFn
  const { mutate, isPending } = useMutation({
    mutationFn: updateFollow,
    onMutate: async ({ type }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(["user", currentUser?.id, "followInfo"]);
      await queryClient.cancelQueries(["user", id, "followInfo"]);
      await queryClient.cancelQueries(["user", "followSuggestions"]);

      // Snapshot the previous value
      const snapShotOfCurrentUser = queryClient.getQueryData([
        "user",
        currentUser?.id,
        "followInfo",
      ]);

      const snapShotOfTargetUser = queryClient.getQueryData([
        "user",
        id,
        "followInfo",
      ]);

      // Optimistically update current user's following
      queryClient.setQueryData(
        ["user", currentUser?.id, "followInfo"],
        (old) => {
          return {
            ...old,
            following:
              type === "follow"
                ? [...old.following, { followingId: id }]
                : old.following.filter((person) => person.followingId !== id),
          };
        }
      );

      // Optimistically update target user's followers
      queryClient.setQueryData(
        ["user", id, "followInfo"],
        (old) => {
          return {
            ...old,
            followers:
              type === "follow"
                ? [...old.followers, { followerId: currentUser?.id }]
                : old.followers.filter((person) => person.followerId !== currentUser?.id),
          };
        }
      );

      return { snapShotOfCurrentUser, snapShotOfTargetUser };
    },
    onError: (err, variables, context) => {
      setFollowed(!followed);
      queryClient.setQueryData(
        ["user", currentUser?.id, "followInfo"],
        context.snapShotOfCurrentUser
      );
      queryClient.setQueryData(
        ["user", id, "followInfo"],
        context.snapShotOfTargetUser
      );
      toast.error("Something wrong happened. Try again!");
      console.error("Error:", err);
    },
    onSettled: () => {
      queryClient.invalidateQueries(["user", currentUser?.id, "followInfo"]);
      queryClient.invalidateQueries(["user", id, "followInfo"]);
    },
  });

  if (isLoading)
    return (
      <Skeleton.Button active={true} size={"large"} style={{ width: "100%" }} />
    );
  if (isError)
    return (
      <Alert
        message="Error while fetching data"
        type="error"
        style={{ width: "100%" }}
      />
    );

  return (
    <Button
      type="primary"
      disabled={isPending} // Changed from isLoading to isPending
      style={{
        background: followed ? "white" : "var(--gradient)",
        border: followed ? "1px solid #d9d9d9" : "none",
        cursor: "pointer",
      }}
      onClick={() => mutate({ 
        id, 
        type: followed ? "unfollow" : "follow",
        userId: currentUser?.id,
       })}
    >
      <Typography className="typoSubtitle2" style={{ 
        color: followed ? "black" : "white", }}>
        {followed ? "Following" : "Follow"}
      </Typography>
    </Button>
  );
};

export default FollowButton;