'use client'
import { theme } from 'antd';
import React, { useState } from 'react'
import { SettingsContext } from './settings-context';


export const SettingsContextProvider = ({children}) => {
    const [settings , setSettings]=useState({
        theme: 'dark',
        isSidebarOpen: false,
        isMiniSidebar: false,
    });
  return (
    <SettingsContext.Provider value={{settings, setSettings}}>
        {children}
    </SettingsContext.Provider>
  )
}

