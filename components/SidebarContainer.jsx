'use client'
import { Drawer } from "antd";
import useWindowDimensions from "@/hooks/useWindowsDimension";
import css from "@/styles/sidebar.module.css";
const SidebarContainer = ({
  isDrawrOpen,
  setIsDrawerOpen,
  children,
  isMiniSidebar = false,
  ...other
}) => {
  const { width } = useWindowDimensions();

  if (width <= 900) {
    return (
      <Drawer
        {...other}
        placement={"left"}
        open={isDrawrOpen}
        onClose={() => setIsDrawerOpen(false)}
        height={"100%"}
      >
        <div className={css.drawerContainer}>{children}</div>
      </Drawer>
    );
  }
  // 900px - 1268px: return mini sidebar wrapper
  if (width >= 900 && width < 1268) {
    return <div className={css.miniSidebarWrapper}  style={{minHeight:"86vh"}}>{children}</div>;
  }

  // >= 1268px: full sidebar
  return <div className={css.fullSidebarWrapper} style={{minHeight:"86vh"}}>{children}</div>;
};

export default SidebarContainer;