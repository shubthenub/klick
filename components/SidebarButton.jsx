"use client";

import { Button, Typography } from "antd";
import Iconify from "./Iconify";
import { useSettings} from "@/context/settings/settings-context";
import useWindowDimensions from "@/hooks/useWindowsDimension";
import { useEffect, useState } from "react";

const SidebarButton = () => {
  const { setSettings } = useSettings();
  const { width } = useWindowDimensions();
  const [isvisible, setIsVisible] = useState(false);
  useEffect(() => {
    if(width< 960) setIsVisible(true); // set mini state based on window size
    else setIsVisible(false);
    
  }, [width]);
  return (
    <Button
      style={{
        display: isvisible ? "block" : "none",
      }}
      type="text"
      onClick={() => {
        setSettings((prev) => ({
          ...prev,
          isSidebarOpen: !prev.isSidebarOpen,
        }));
      }}
      icon={
        <Typography>
          <Iconify icon="heroicons-solid:menu-alt-2" width="22px" />
        </Typography>
      }
    />
  );
};

export default SidebarButton;
