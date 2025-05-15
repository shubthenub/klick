import { SettingsContext } from "@/context/settings/settings-context";
import React, { useContext } from "react";
import Box from "./Box/Box";
import { Avatar, Flex, Typography } from "antd";
import dayjs from "dayjs";
import css from "@/styles/post.module.css";
import cx from "classnames";

const Comment = ({ data }) => {
  console.log(data);
  const {
    settings: { theme },    //so that on theme change comment changes bg color
  } = useContext(SettingsContext);
  return (
    <Flex gap={"0.5rem"}>
      {/* avatar of user */}
      <Avatar size={25} src={data?.author?.image_url} />
      {/* comment */}
      <Flex flex={1} gap="0.5rem" className={cx(css.comment , css[theme])}>
        <Flex
          vertical
          gap="0.5rem"
          style={{ width: "100%", padding: "0.4rem" }}
        >
          <Flex gap={"1rem"} justify="space-between"
          style={{fontSize:".8rem" , fontWeight:"500"}}>
            {/* name of author */}
            <Typography.Text>
              {data?.author?.first_name} {data?.author?.last_name}
            </Typography.Text>

            {/* date */}
            <Typography.Text type="secondary">
              {dayjs(data?.createdAt).format("DD MMM, YYYY")}
            </Typography.Text>
          </Flex>
          {/* comment text */}
          <Typography.Text>{data?.comment}</Typography.Text>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default Comment;
