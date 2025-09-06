"use client"
import React from 'react'
import css from '@/styles/header.module.css';
import Box from './Box/Box';
import Image from 'next/image';
import { Flex } from 'antd';
import { UserButton } from '@clerk/nextjs';
import ModeButton from './ModeButton';
import SidebarButton from './SidebarButton';
import { useContext } from 'react';
import { SettingsContext } from "@/context/settings/settings-context";
import NotificationButton from './NotificationButton';

const Header = () => {
  const {settings} = useContext(SettingsContext);
  return (
    <div className={css.wrapper}>
      <Box style={{
        height:"100%",
        borderBottom: settings.theme=="light"?"0.5px solid rgba(71, 59, 59, 0.1)": "0.5px solid rgba(88, 86, 86, 0.69)",
      }}>
        
        <div className={css.container}>
          <div style={{display:"flex", alignItems:"center"}} >
            <div className={css.sidebarButton}>
            <SidebarButton/>
            </div>
            <Image src="/images/logo1.png" alt="Logo" width={150} height={45} quality={100} />
          </div>
          

           {/* actions */}
           <Flex gap={25} align="center"> 
            <NotificationButton />
            <ModeButton/>
            <UserButton />
          </Flex>
        </div>
      </Box>
    </div>
  )
}

export default Header
