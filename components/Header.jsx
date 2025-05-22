import React from 'react'
import css from '@/styles/header.module.css';
import Box from './Box/Box';
import Image from 'next/image';
import { Flex } from 'antd';
import { UserButton } from '@clerk/nextjs';
import ModeButton from './ModeButton';
import SidebarButton from './SidebarButton';

const Header = () => {
  return (
    <div className={css.wrapper}>
      <Box style={{
        height:"100%",
      }}>
        
        <div className={css.container}>
          <div className={css.sidebarButton}>
          <SidebarButton/>
          </div>
          <Image src="/images/logo1.png" alt="Logo" width={150} height={45} quality={100} />

           {/* actions */}
           <Flex gap={25} align="center"> 
            <ModeButton/>
            <UserButton />
          </Flex>
        </div>
      </Box>
    </div>
  )
}

export default Header
