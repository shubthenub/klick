"use client";
import React, { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getFeed, getMyPosts } from "../actions/post";
import { Flex, Spin, Typography } from "antd";
import { LoadingOutlined } from '@ant-design/icons';
import { useInView } from "react-intersection-observer";
import Post from "./Post";
import { useUser } from "@clerk/nextjs";

const Posts = ({id="all"}) => {//id==all for feed , id=userId for profile page
  // Infinite scroll logic using react-intersection-observer
  const { ref, inView } = useInView();
  const { user: currentUser } = useUser();
  const {
    data,
    isLoading,
    isError,
    isSuccess,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts" , id],
    queryFn: ({ pageParam = "" }) => 
    id==="all" ? getFeed(pageParam , currentUser?.id) : getMyPosts(pageParam, id),// for feed
    
    
    getNextPageParam: (lastPage) => lastPage?.metadata?.lastCursor,
  });

  // Trigger fetching next page when inView is true
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  if (isError) {
    return <Typography>Something went Wrong</Typography>;
  }

  if (isLoading) {
    return (
      <Flex vertical align="center" gap="large" justify="center">
        <Spin indicator={<LoadingOutlined spin />} size="large" />
      </Flex>
    );
  }

  return ( isSuccess &&
    <Flex vertical gap="2rem">
      {data?.pages?.map((page, pageIndex) =>
        page?.data?.map((post, index) => {
          const isLastItem =
            pageIndex === data.pages.length - 1 &&
            index === page.data.length - 1;

          return (
            <div
              key={post?.id || `${pageIndex}-${index}`}
              ref={isLastItem ? ref : null} // Attach ref to the last post
              // style={{
              //   width: "100%",
              //   height: "30rem",
              // }}
            >
              <Post data={post} queryId={id}/>
            </div>
          );
        })
      )}

      {hasNextPage && (
        <Flex align="center" justify="center" gap="large">
          <Spin />
          <Typography>Loading...</Typography>
        </Flex>
      )}
    </Flex>
  );
};

export default Posts;
