'use client' 
import { theme } from 'antd';
import React from 'react'

const Box = ({
    children,
    type ="boxBg",
    style,
    ...other
}) => {
    const {useToken} = theme;
    const {token} = useToken();
  return (
    <div 
    {...other}
    style={{
        backgroundColor: token[type],
        boxShadow: "0 4px 10px 1px rgba(0,0,0,0.03)",
        ...style,
      }}
    >
      
      
      {children}
    </div>
  )
}

export default Box
