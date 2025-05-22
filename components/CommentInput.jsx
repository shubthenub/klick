import { addComment } from '@/actions/post';
import { useUser } from '@clerk/nextjs';
import { Icon } from '@iconify/react';
import { Button, Flex, Input } from 'antd'
import Avatar from 'antd/es/avatar/avatar'
import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const CommentInput = ({queryId , postId , setExpanded}) => {
    const {user} = useUser();
    const [value , setValue] = React.useState("");

    const queryClient = useQueryClient();

    const {isPending , mutate}=useMutation({
        mutationFn:(postId)=>addComment(postId , value , user.id),

        //too optimistically update the comments on feed
        onMutate: async()=>{
            // setExpanded(true);
            //cancel any outgoing refetches
            await queryClient.cancelQueries(queryId);
            //snapshot the previous value
            const previousPosts = queryClient.getQueryData(queryId);
            //optimistically update the comments
            queryClient.setQueryData(['posts', queryId], (old) => ({
                ...old,
                pages: old.pages.map((page) => ({
                    ...page,
                    data: page.data.map((post) =>
                        post.id === postId
                            ? {
                                  ...post,
                                  comments: [
                                      ...post.comments,
                                      {
                                          comment: value,
                                          authorId: user?.id,
                                          author: {
                                              first_name: user?.firstName,
                                              last_name: user?.lastName,
                                              imageUrl: user?.imageUrl,
                                          },
                                      },
                                  ],
                              }
                            : post
                    ),
                })),
            }))
            return {previousPosts};
        },
        onError:(error, variables, context)=>{
            toast.error("Failed to add comment");
            //rollback to the previous value
            queryClient.setQueryData(queryId, context.previousPosts);
        },
        onSettled:()=>{
            queryClient.invalidateQueries(["post"]);
            setValue("");
        }
    })
  return (
    <Flex gap={"1rem"} align='center' 
    > 
        <Avatar src={user?.imageUrl} size={30} style={{minWidth:"30px"}} />

        {/* input box */}
        <Input.TextArea
            variant='borderless'
            placeholder='Comment..'
            style={{resize:"none"}}
            autoSize={{minRows:1 , maxRows:5}}
            value={value}
            onChange={(e) => setValue(e.target.value)}
        />
        <Button
            type='primary'
            onClick={() => mutate(postId)}
            disabled={isPending || !value || value===""}
        >
            <Icon icon={"iconamoon:send-fill"} width={"1rem"}/>
        </Button>
    </Flex>
  )
}

export default CommentInput
