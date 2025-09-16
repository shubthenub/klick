import React, { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getFeed, getMyPosts } from "../actions/post";
import { Flex, Spin, Typography } from "antd";
import { LoadingOutlined } from '@ant-design/icons';
import { useUser } from "@clerk/nextjs";
import PostSkeleton from "./PostSkeleton";
import Post from "./Post";

const Posts = ({ id = "all", take = 5 }) => {
  const { user: currentUser } = useUser();
  const postRefs = useRef({});

  const {
    data,
    isLoading,
    isError,
    isSuccess,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts", id, take],
    enabled: !!currentUser?.id,
    queryFn: ({ pageParam = "" }) =>
      id === "all"
        ? getFeed(pageParam, currentUser?.id, take)
        : getMyPosts(pageParam, id, take),
    getNextPageParam: (lastPage) => {
      const hasMore = lastPage?.metadata?.hasMore || lastPage?.metaData?.hasMore;
      const cursor = lastPage?.metadata?.lastCursor || lastPage?.metaData?.lastCursor;
      console.log('🔍 getNextPageParam debug:', { hasMore, cursor, cursorType: typeof cursor });
      return hasMore && cursor ? cursor : undefined;
    },
    staleTime: Infinity,
    cacheTime: Infinity,
  });

  // Fetch next page when user is at n-3rd post from the end (more aggressive)
  useEffect(() => {
    if (!data?.pages || !hasNextPage || isFetchingNextPage) {
      console.log('🚫 Skipping observer setup:', { 
        hasPages: !!data?.pages, 
        hasNextPage, 
        isFetchingNextPage 
      });
      return;
    }
    
    const allPosts = data.pages.flatMap(page => page.data || []);
    console.log('📊 Total posts for observer:', allPosts.length);
    
    // Debug the posts structure
    if (allPosts.length > 0) {
      console.log('🔍 Sample post structure:', {
        firstPost: allPosts[0],
        firstPostId: allPosts[0]?.id,
        lastPost: allPosts[allPosts.length - 1],
        lastPostId: allPosts[allPosts.length - 1]?.id
      });
    }
    
    if (allPosts.length > 3) {
      const targetIndex = Math.max(0, allPosts.length - 4); // when user is at n-3rd post from the end
      const targetPost = allPosts[targetIndex];
      
      // Parse the post if it's stringified
      const parsedTargetPost = typeof targetPost === 'string' ? JSON.parse(targetPost) : targetPost;
      const targetId = parsedTargetPost?.id;
      
      console.log('🎯 Setting up observer for post:', {
        targetIndex,
        targetPost: parsedTargetPost,
        targetId,
        totalPosts: allPosts.length,
        hasElement: !!postRefs.current[targetId]
      });
      
      if (targetId && postRefs.current[targetId]) {
        const observer = new window.IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
                console.log("📥 TRIGGERING: Fetching next page for post:", targetPost?.id);
                fetchNextPage();
              }
            });
          },
          { threshold: 0.1, rootMargin: '200px' } // Trigger even earlier
        );
        
        observer.observe(postRefs.current[targetId]);
        console.log('✅ Observer set up for post:', targetId);
        
        return () => {
          console.log('🧹 Cleaning up observer for post:', targetId);
          observer.disconnect();
        };
      } else {
        console.log('⚠️ No element found for targetId:', targetId);
      }
    } else {
      console.log('🐛 Not enough posts for observer:', allPosts.length);
    }
  }, [data?.pages, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isError) {
    return <Typography>Something went Wrong</Typography>;
  }

  if (isLoading) {
    return <PostSkeleton />;
  }

  // Debug logging
  console.log('🔍 Posts component data:', data);
  console.log('🔍 Has next page:', hasNextPage);
  console.log('🔍 Is fetching next page:', isFetchingNextPage);
  console.log('🔍 Data pages:', data?.pages?.length);
  if (data?.pages?.length > 0) {
    const lastPage = data.pages[data.pages.length - 1];
    console.log('🔍 Last page metadata:', lastPage?.metadata || lastPage?.metaData);
  }

  return (
    isSuccess && (
      <Flex vertical gap="2rem">
        {data?.pages?.map((page, pageIndex) =>
          page?.data?.map((post, index) => {
            // Fix stringified post data
            const parsedPost = typeof post === 'string' ? JSON.parse(post) : post;
            
            const isLastItem =
              pageIndex === data.pages.length - 1 &&
              index === page.data.length - 1;
            return (
              <div
                key={parsedPost?.id || `${pageIndex}-${index}`}
                ref={el => {
                  postRefs.current[parsedPost?.id] = el;
                }}
              >
                <Post data={parsedPost} queryId={["posts", id]} />
              </div>
            );
          })
        )}
        {hasNextPage && (
          <Flex align="center" justify="center" gap="large">
            <Spin indicator={<LoadingOutlined spin />} size="large" />
            <Typography></Typography>
          </Flex>
        )}
      </Flex>
    )
  );
};

export default Posts;