import React from "react";
import css from "@/styles/PopularTrends.module.css";
import { Alert, Avatar, Flex, Typography } from "antd";
import { getPopularTrends } from "@/actions/post";
import { useQuery } from "@tanstack/react-query";
import Iconify from "./Iconify";

const PopularTrends = () => {
  //logic of trending section is the post must be contain hashtags
  //go to post.js action and include this before returning post in createpost function
  const { data, error, isLoading } = useQuery({
    queryKey: ["trends"],
    queryFn: getPopularTrends,
    staleTime: 1000 * 60 * 60 * 24, // Cache for 1 day
  });
  console.log(data);
  const trends = Array.isArray(data?.data) ? data.data : [];
 // Ensure it's always an array

  try {
    return (
      <div className={css.wrapper}>
        <div className={css.bg} />

        <div className={css.container}>
          <Flex vertical>
            <Typography className="typoSubtitle2">Top Trending</Typography>
            <Typography className="typoH4">Popular Trends</Typography>
          </Flex>
          <Flex vertical gap={15}>
            {trends.map((trend, i) => (
              <Flex key={i} gap={"1rem"} align="center">
                {/* trend icon */}
                <Avatar
                  style={{ background: "#FF990047" }}
                  icon={
                    <Iconify
                      icon="mingcute:hashtag-fill"
                      color="var(--primary)"
                      width="18px"
                    />
                  }
                />
                {/* trend info */}
                <Flex vertical>
                  <Typography
                    className="typoSubtitle1"
                    style={{ fontWeight: "bold" }}
                  >
                    {trend.name}
                  </Typography>
                  <Typography
                    className="typoCaption"
                    style={{ fontWeight: "bold", color: "gray" }}
                  >
                    {trend?._count?.name} Posts
                  </Typography>
                </Flex>
              </Flex>
            ))}
          </Flex>
        </div>
      </div>
    );
  } catch (error) {
    console.log(error);
    return (
      <Alert
        message="Error"
        description="An error occured while fetching popular trends"
        type="error"
        showIcon
      />
    );
  }
};
export default PopularTrends;
