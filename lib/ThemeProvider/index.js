'use client';
import { useSettings } from "@/context/settings/settings-context";
import { ConfigProvider , theme  } from "antd";
import { useCallback } from "react";

export const ThemeProvider = ({ children }) => {
    const{
        settings:{theme:globalTheme}
    }=useSettings();


    const BoxBg = useCallback(()=>{
        return globalTheme==='dark'?"rgb(0, 0, 0)":"white";//20 26 33
    },[globalTheme]);
    const BaseBg=useCallback(()=>{
        return globalTheme==='dark'?"rgb(16, 16,16)":"#f4f6f8";
    },[globalTheme]);

    return (
        <ConfigProvider
          theme={{
            algorithm:
              globalTheme === "light"
                ? theme.defaultAlgorithm
                : theme.darkAlgorithm,
            token: {
              fontFamily: 'inherit',
              colorPrimary: "#F9AA11",
              boxBg: BoxBg(),
              baseBg: BaseBg(),
            },
            components: {
              Typography: {
                fontSize: 'none',
                lineHeight: 'none',
                fontWeightStrong: 'none',
              }
            }
          }}
        >
          {children}
        </ConfigProvider>
      );
    };
    