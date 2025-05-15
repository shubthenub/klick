import React from 'react'
import css from '@/styles/profileView.module.css'
import { Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import FollowInfoBox from '@/components/FollowInfoBox'
import PostGenerator from '@/components/PostGenerator'
import { useUser } from '@clerk/nextjs'
import Posts from '@/components/Posts'
import FollowSuggestions from '@/components/FollowSuggestions'
import FollowButton from '@/components/FollowButton'
import { usePathname } from 'next/navigation'

const ProfileBody = () => {
  // console.log("logging from profile body",params) THIS ONLY WORKS IN DYNAMIC ROUTES
  const {user: currentUser} = useUser()
  const pathname = usePathname();
  
  // Extract userId from pathname
  const pathParts = pathname.split('/');
  const userId = pathParts[pathParts.length - 1].split('?')[0];
  console.log("logging from profile body", userId)
  const isCurrentUser = currentUser?.id === userId
  
  return (
    <div className={css.profileBody}>
      <div className={css.left}>
        <div className={css.sticky}>
            {!isCurrentUser && (
              <FollowButton id={userId} />
            )}
            <FollowInfoBox id={userId}/>
            <FollowSuggestions id={userId}/>
        </div>
      </div>
      <div className={css.right}>
          {
            isCurrentUser && <PostGenerator/>
          }
          <Typography 
          style={
            {fontSize: "1.5rem",
             fontWeight: "600",
            margin:"auto"}
          }
          className={css.postTitle}>Posts</Typography>
          {/* to only get your posts  */}
          <Posts id={userId}/> 
      </div>
    </div>
  )
}

export default ProfileBody
