import { Icon } from '@iconify/react'
import { Button, Flex, Input } from 'antd'
import React from 'react'

const ChatInput = () => {
  return (
    <Flex gap={"1rem"} align='center' 
    > 
        {/* <Avatar src={user?.imageUrl} size={30} style={{minWidth:"30px"}} /> */}

        {/* input box */}
        <Input.TextArea
            placeholder='Message..'
            typeof='text'
            style={{resize:"none"}}
            autoSize={{minRows:1 , maxRows:5}}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <Button
            type='primary'
            onClick={() => sendMessage()}
        >
            <Icon icon={"iconamoon:send-fill"} width={"1rem"}/>
        </Button>
    </Flex>
  )
}

export default ChatInput
