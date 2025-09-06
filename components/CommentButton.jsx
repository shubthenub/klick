import { Icon } from '@iconify/react'
import { Button, Flex, Typography } from 'antd'
import React from 'react'

const CommentButton = ({comments}) => {
  return (
    <Button type='text' size='small'>
        <Flex gap={"0.5rem"} align="center">
            <Icon
                icon="iconamoon:comment-dots-fill"
                width={"21px"}
                color='grey'
            />
            <Typography.Text>
                {comments>0 ? comments : ""}
            </Typography.Text>
        </Flex>
    </Button>
  )
}

export default CommentButton
