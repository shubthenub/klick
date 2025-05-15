'use client'
import React from 'react'
import css from '@/styles/profileView.module.css'
import ProfileHead from '@/components/ProfileHead'
import { getUser } from '@/actions/user'
import { useQuery } from '@tanstack/react-query'
import ProfileBody from '../ProfileBody'
import FollowPersonBody from '@/components/FollowPersonBody'
const ProfileView = ({userId}) => {
  const {data , isLoading , isError} = useQuery({
    queryKey : ['user' , {userId}],
    queryFn : ()=> getUser(userId)
  })
  console.log(data)
  const [selectedTab, setSelectedTab] = React.useState("1");

  return(
    <div className={css.wrapper}>
      <div className={css.container}>
        {/* head secton of profile page */}
        <ProfileHead
          data={data}
          isLoading={isLoading}
          isError={isError}
          userId={userId}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
        />

        {/* body */}
        {
          selectedTab==="1" &&(
            <ProfileBody/>
          )
        } 
        {
          selectedTab==="2" &&(
            <FollowPersonBody type="followers" id={userId}/>
          )
        }
        {
          selectedTab==="3" &&(
            <FollowPersonBody type="following" id={userId}/>
          )
        }
        {
          selectedTab==="4" &&(
            <div className={css.suggestion}>
              <h1>Suggestions</h1>
            </div>
          )
        }

      </div>
    </div>
  )
}

export default ProfileView
