import React from 'react'
import { getAllFollowersAndFollowingInfo } from '@/actions/user'
import { useUser } from '@clerk/nextjs'
const layout = ({children}) => {
  return (
    <>  <h1>Messages</h1>
        
        
      {children}
    </>
    
  )
}

export default layout
