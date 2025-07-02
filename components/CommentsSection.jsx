import { Icon } from '@iconify/react';
import { Button, Flex } from 'antd';
import React from 'react'
import css from '@/styles/commentSection.module.css';
import CommentInput from './CommentInput';
import Comment from './Comment';

const CommentsSection = ({comments , postId , queryId}) => {
    const [expanded , setExpanded] = React.useState(false);
  return (
      <Flex vertical gap="1rem" 
      className={`${css.commentsContainer} ${expanded ? css.expanded : css.collapsed}`}
        
      >
        <>
            {/* comments */}
            {
                comments?.length>0 && (
                    <Flex
                    // style={{borderBottom:"1px solid hsla(0, 1.90%, 42.00%, 0.48)",}}
                    vertical
                    gap="0.5rem"
                    className={css.commentsContainer}
                    >
                    {
                        !expanded?(
                            <Comment 
                            data={comments[comments.length - 1]}
                            />
                        ):(
                            [...comments].reverse()?.map((comment , index) => ( //to get the latest comment at the top
                                <Comment
                                key={index}
                                data={comment}
                                />
                            )
                        ))
                    }

                    </Flex>

                )
            }
            {/* show more comments button */}
            {comments?.length > 1 && (
                <Button 
                type='text'
                onClick={() => setExpanded(!expanded)}
                 >
                    <Flex align='center' gap='0.5rem'>
                        <Icon icon={(!expanded)?"ic:outline-expand-more":"ic:outline-expand-less"} />
                        {(!expanded)?`Show all comments`:"Show less comments"}
                    </Flex>

                </Button>
            )}
            </>
            {/* input comments */}
            <CommentInput
                setExpanded={setExpanded}
                queryId={queryId}
                postId={postId}
            />
      </Flex>
  )
}

export default CommentsSection
