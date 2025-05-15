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
        queryFn: () => getAllFollowersAndFollowingInfo(id),
        enabled: !!id,
        staleTime: 1000 * 60 * 5, // 5 minutes
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
                    {userData?.[type]?.map((person, i) => (
                        console.log("rendering person", person),
                        <UserBox
                            style={{
                                width: "100%",
                            }}
                            key={person?.[type === "followers" ? "followerId" : "followingId"] || i}
                            type={type === "followers" ? "follower" : "following"}
                            data={person} // TARGET USER DATA
                            loggedInUserData={loggedInUserData} // LOGGED IN USER DATA
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FollowPersonBody;