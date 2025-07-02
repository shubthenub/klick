import { Button, Flex, Image, Skeleton, Spin, Tabs, Typography } from "antd";
import React, { useEffect } from "react";
import css from "@/styles/profileHead.module.css";
import { useUser } from "@clerk/nextjs";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { useMutation } from "@tanstack/react-query";
import { updateBanner } from "@/actions/user";
import Box from "./Box/Box";
import { LoadingOutlined } from '@ant-design/icons';
const { Text } = Typography;
const TABS=[
    {
        label: "Profile",
        icon: "solar:user-id-bold"
    },
    {
        label: "Followers",
        icon: "ph:heart-fill"
    },
    {
        label: "Following",
        icon: "fluent:people-2--filled"
    }
]

const ProfileHead = ({ userId, data, isLoading, isError , selectedTab , setSelectedTab}) => {
  const [bannerPreview, setBannerPreview] = React.useState(false);
  const { user } = useUser();
  const inputRef = React.useRef(null);
  const [banner, setBanner] = React.useState(null);

  const { mutate, isPending } = useMutation({
    mutationFn: updateBanner, //define this in user.js
    onSuccess: () => {
      console.log("triggering toast");
      toast.success("Banner updated successfully");
    },
    onError: () => toast.error("Failed to update banner , try again"),
  });

  useEffect(() => {
    if (data?.data?.banner_url) {
      setBanner(data?.data?.banner_url);
    }
  }, [data, setBanner]);

  const handleBannerChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error("banner size should be less than 5MB");
      return;
    }
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        setBanner(reader.result);
        mutate({
          id: user?.id,
          banner: reader.result,
          prevBannerId: data?.data?.banner_id,
        });
      };
    }
  };

  return (
    <div className={css.container}>
      <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
        spinning={isPending}
        style={{
          position: "absolute",
          top: "5%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 100,
        }}
      />
      {/* banner section of profile page */}
      <div className={css.banner} onClick={() => setBannerPreview(true)}>
        {!isLoading ? (
          <>
            <Image
              src={
                banner ||
                "https://www.freepik.com/free-photo/abstract-surface-textures-white-concrete-stone-wall_4326138.htm#fromView=keyword&page=1&position=0&uuid=c37673c9-c09b-4ee6-80a3-1349453af6c0&query=White+Background"
              }
              alt=""
              width={"100%"}
              height={"15rem"}
              preview={{
                mask: null,
                visible: bannerPreview,
                onVisibleChange: (visible) => setBannerPreview(visible),
              }}
            />
          </>
        ) : (
          <Skeleton.Image active style={{ width: "100", height: "15rem" }} />
        )}

        {userId === user?.id && (
          <div className={css.editButton} onClick={(e) => e.stopPropagation()}>
            <input
              accept="image/*"
              type="file"
              ref={inputRef}
              multiple={false}
              onChange={(e) => handleBannerChange(e)}
              hidden
            />
            <Button
              onClick={() => inputRef.current.click()}
              type="primary"
              shape="circle"
              icon={<Icon icon="fluent:image-edit-20-filled" width={"20px"} />}
            />
          </div>
        )}
      </div>
      <Box>
        <div className={css.footer}>
          {/* left side */}
          <div className={css.left}>
            {/* profile info */}
            <div className={css.profile}>
              <div className={css.profileImage}>
                <Image
                  src={
                    data?.data?.image_url ||
                    "https://www.freepik.com/free-photo/abstract-surface-textures-white-concrete-stone-wall_4326138.htm#fromView=keyword&page=1&position=0&uuid=c37673c9-c09b-4ee6-80a3-1349453af6c0&query=White+Background"
                  }
                  alt=""
                  preview={{ mask: null }}
                />
              </div>
              {/* name */}
              <div className={css.profileInfo}>
                {!isLoading ? (
                  <>
                    {/* this text have be to destructured and imported */}
                    <Text className={"typoH6"}>
                      {data?.data?.first_name} {data?.data?.last_name}
                    </Text>
                    <Text className={"typoBody1"} type="secondary">
                      @{data?.data?.username}
                    </Text>
                  </>
                ) : (
                  <Skeleton
                    style={{ width: "9rem" }}
                    active
                    paragraph={{ rows: 2 }}
                  />
                )}
              </div>
            </div>
          </div>
          <div className={css.right}>
                <div className={css.tabs}> 
                    {/* seperate state for tabs will be needed to show feed of that tab*/}
                    <Tabs 
                        centered
                        defaultActiveKey={selectedTab}
                        onChange={(key)=>setSelectedTab(key)}
                        items={TABS.map((tab , i)=>{
                            const id= String(i+1)
                            return {
                                key: id,
                                label:(
                                    <Flex align="center" gap="0.3em">
                                        <Icon icon={tab.icon} width={"20px"}/>
                                        <span className="typoSubtitle2">{tab.label}</span>
                                    </Flex>
                                )
                            }
                        })}
                    />
                </div>
          </div>
        </div>
      </Box>
    </div>
  );
};

export default ProfileHead;
