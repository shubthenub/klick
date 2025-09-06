import { getAllFollowersAndFollowingInfo } from "@/actions/user";
import { Alert, Skeleton, Typography } from "antd";
import React from "react";
import css from "@/styles/followPersonBody.module.css";
import { useQuery } from "@tanstack/react-query";
import UserBox from "./UserBox";
import { useUser } from "@clerk/nextjs";

const FollowPersonBody = ({ id, type }) => {
    const { user: currentUser } = useUser();
    // console.log("trying to get data of user", id, type);

    // Get data of target person (either follower or following)
    const {
        data: userData,
        isLoading: userDataLoading,
        isError: userDataError,
    } = useQuery({
        queryKey: ["user", id, "followInfo"],
        queryFn: async () => {
            console.log("🚀 React Query calling getAllFollowersAndFollowingInfo for:", id);
            const result = await getAllFollowersAndFollowingInfo(id);
            
            // ✅ Debug what React Query receives from the function
            console.log("🔍 React Query received from getAllFollowersAndFollowingInfo:", {
                userId: id,
                result,
                followersStructure: result?.followers?.[0],
                followingStructure: result?.following?.[0],
                hasCompleteData: {
                    follower: !!result?.followers?.[0]?.follower,
                    following: !!result?.following?.[0]?.following
                }
            });
            
            return result;
        },
        enabled: !!id,
        staleTime: 0, // ✅ Disable cache temporarily
        cacheTime: 0, // ✅ Disable cache temporarily
        // ✅ Add onSuccess callback
        onSuccess: (data) => {
            console.log("🎯 React Query onSuccess callback - final data:", {
                userId: id,
                data,
                followersCount: data?.followers?.length,
                followingCount: data?.following?.length,
                sampleFollower: data?.followers?.[0],
                sampleFollowing: data?.following?.[0]
            });
        }
    });

    // Get data of logged in user
    const {
        data: loggedInUserData,
    } = useQuery({
        queryKey: ["user", currentUser?.id, "followInfo"],
        queryFn: () => getAllFollowersAndFollowingInfo(currentUser?.id),
        enabled: !!currentUser?.id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    if (userDataLoading) {
        return (
            <div className={css.container}>
                <Skeleton.Button
                    active={true}
                    size="large"
                    style={{
                        width: "100%",
                        height: "3.5rem",
                    }}
                />
            </div>
        );
    }

    if (userDataError) {
        return (
            <div className={css.container}>
                <Alert message="Error while loading the data" type="error" />
            </div>
        );
    }

    return (
        <div className={css.container}>
      <div className={css.head}>
        <Typography.Title level={4}>{type}</Typography.Title>
      </div>
      
      {userData?.[type]?.length === 0 ? (
        <Alert message={`No ${type} found`} type="info" />
      ) : (
        <div className={css.body}>
          {userData?.[type]?.map((person, i) => {
            console.log("userData", userData);
            console.log("FollowPersonBody - Passing person to UserBox:", person);
            return (
              <UserBox
                style={{ width: "100%" }}
                key={person?.[type === "followers" ? "followerId" : "followingId"] || i}
                type={type === "followers" ? "follower" : "following"}
                data={person} // ✅ Pass the complete person object, not just the ID
                loggedInUserData={loggedInUserData}
              />
            );
          })}
        </div>
      )}
    </div>
    );
};

export default FollowPersonBody;