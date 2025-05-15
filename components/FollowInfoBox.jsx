import React from 'react'
import {useQuery} from '@tanstack/react-query'
import { Alert, Skeleton, Space, Typography } from 'antd'
import Box from './Box/Box'
import css from '@/styles/followInfoBox.module.css'
import { getAllFollowersAndFollowingInfo } from '@/actions/user'


const FollowInfoBox = ({id}) => {
    const {data , isLoading , isError} = useQuery({
        queryKey : ['user' , id, 'followInfo'],
        queryFn : ()=> getAllFollowersAndFollowingInfo(id),
        enabled : !!id,
        staleTime : 1000 * 60 * 20,
    })
    // console.log("follow table:")
    // console.log(data)

    if(isLoading)
      return(
        <Alert message="Error while fetching data" type="info" />
      );
    if(isError)
      return(
        <Box className={css.container}>
          <Typography className='"typoH5'>Error loading follow info</Typography>
        </Box>
      );
  return (
    <>
    <Box className={css.container}>
      <Space direction="horizontal" align="center">
        <Typography className='{"typoH5'>{data?.followers?.length} Followers</Typography>
        <Typography className='{"typoH5'>{data?.following?.length} Followings</Typography>
      </Space>
    </Box>
    </>
  );
}

export default FollowInfoBox
