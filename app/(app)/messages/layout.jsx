import React from 'react'
import { getAllFollowersAndFollowingInfo } from '@/actions/user'
import { useUser } from '@clerk/nextjs'
const layout = ({children}) => {
  return (
    <>  
        {children}
    </>
    
  )
}

export default layout
