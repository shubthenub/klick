"use client";
import { Icon } from '@iconify/react';
import { Button, Flex, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import React from 'react';
import css from '@/styles/commentSection.module.css';
import CommentInput from './CommentInput';
import Comment from './Comment';
import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { SettingsContext } from '@/context/settings/settings-context';
import { toast } from 'react-hot-toast';
import CommentSkeleton from './CommentSkeleton';

const PAGE_SIZE = 10;

const CommentsSection = ({ postId, queryId, totalCommentsFromPost }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [replyingTo, setReplyingTo] = React.useState(null);
  const { user } = useUser();
  const containerRef = React.useRef(null);
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(
        `/api/comment/${postId}?page=${pageParam}&limit=${PAGE_SIZE}`
      );
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    getNextPageParam: (last) =>
      last?.pagination?.hasMore ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
    enabled: !!postId,
  });

  const allComments = React.useMemo(() =>
    data?.pages?.flatMap(page => page.comments || []) || [],
    [data?.pages]
  );

  const topLevelComments = React.useMemo(() =>
    allComments.filter((c) => !c.parentId),
    [allComments]
  );
    
  const effectiveTotalComments = topLevelComments.length;

  const initialComment = !expanded && topLevelComments[0] ? topLevelComments[0] : null;
  
  const handleShowMore = React.useCallback(() => {
    if (!expanded) {
      setExpanded(true);
    } else {
      fetchNextPage();
    }
  }, [expanded, fetchNextPage]);

  const handleShowLess = React.useCallback(() => {
    setExpanded(false);
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 300);
  }, []);

  while(isLoading){
    return (
      <CommentSkeleton/>
    );
  }

  return (
    <Flex vertical gap="1rem" className={`${css.commentsContainer} ${expanded ? css.expanded : css.collapsed}`} ref={containerRef}>
      {/* Show initial comment when not expanded */}
      {!expanded && initialComment && (
        <Comment 
          key={initialComment.id}
          data={initialComment} 
          postId={postId} 
          queryId={queryId} 
          setReplyingTo={setReplyingTo} 
          replyingTo={replyingTo} 
          hideRepliesInitially={false} 
        />
      )}

      {/* Show all comments when expanded */}
      {expanded && (
        <Flex vertical gap="0.5rem">
          {isLoading && !data ? (
            <Flex align="center" justify="center" gap="large" style={{ padding: '2rem' }}>
              <Spin indicator={<LoadingOutlined spin />} size="small" />
            </Flex>
          ) : (
            topLevelComments.map((comment) => (
              <Comment 
                key={`comment-${comment.id}`} 
                data={comment} 
                postId={postId} 
                queryId={queryId} 
                setReplyingTo={setReplyingTo} 
                replyingTo={replyingTo} 
                hideRepliesInitially={true} 
              />
            ))
          )}
        </Flex>
      )}

      {/* Show More/Less Button - Use effective total count */}
      {((effectiveTotalComments > 1) && !expanded) && (
        <Button 
          type="text" 
          onClick={handleShowMore}
          loading={isFetchingNextPage}
          style={{
            padding: '4px 8px',
            height: 'auto',
            fontSize: '14px',
            color: '#888',
            fontWeight: '500',
            border: 'none',
            background: 'transparent',
            transition: 'color 0.2s ease'
          }}
          className="hover:!text-blue-500"
        >
          <Flex align="center" gap="4px">
            <Icon icon="ic:outline-expand-more" style={{ fontSize: '16px' }} />
            <span>
              View {effectiveTotalComments - 1} more comment{effectiveTotalComments - 1 > 1 ? 's' : ''}
            </span>
          </Flex>
        </Button>
      )}
      
      {expanded && (
        <Flex align="center" justify='center' gap="1rem" style={{ marginTop: '8px' }}>
          <Button 
            type="text" 
            onClick={handleShowLess}
            style={{
              padding: '4px 8px',
              height: 'auto',
              fontSize: '14px',
              color: '#888',
              fontWeight: '500',
              border: 'none',
              background: 'transparent',
              transition: 'color 0.2s ease'
            }}
            className="hover:!text-blue-500"
          >
            <Flex align="center" gap="4px">
              <Icon icon="ic:outline-expand-less" style={{ fontSize: '16px' }} />
              <span>Show less</span>
            </Flex>
          </Button>

          {hasNextPage && (
            <Button 
              type="text" 
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
              style={{ 
                padding: '4px 8px',
                height: 'auto',
                fontSize: '14px',
                color: '#888',
                fontWeight: '500',
                border: 'none',
                background: 'transparent'
              }}
              className="hover:!text-blue-500"
            >
              <Flex align="center" gap="4px">
                <Icon icon="ic:outline-expand-more" style={{ fontSize: '16px' }} />
                <span>Load more</span>
              </Flex>
            </Button>
          )}
        </Flex>
      )}
      {!isLoading &&
        <CommentInput
          postId={postId}
          queryId={queryId} 
        />
      }
      
    </Flex>
  );
};

export default CommentsSection;