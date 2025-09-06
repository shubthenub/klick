import React from "react";
import { Skeleton, Flex, Avatar, Typography } from "antd";
import Box from "./Box/Box";
import css from "@/styles/post.module.css";

const PostSkeleton = () => {
  return (
    <div className={css.wrapper}>
      <Box>
        <div className={css.container}>
          {/* Profile Info */}
          <Flex align="center" justify="space-between" style={{ marginBottom: "1rem" }}>
            <Flex gap="0.5rem" align="center">
              <Skeleton.Avatar active size={40} shape="circle" />
              <Flex vertical gap="0.3rem">
                <Skeleton.Input active size="small" style={{ width: 120 }} />
                <Skeleton.Input active size="small" style={{ width: 80 }} />
              </Flex>
            </Flex>
            <Skeleton.Button active size="small" style={{ width: 20 }} />
          </Flex>

          {/* Caption */}
          <Skeleton active paragraph={{ rows: 2 }} title={false} style={{ marginBottom: "1rem" }} />

          {/* Media */}
          <div className={css.mediaContainer}>
            <div className={css.skeletonImageWrapper}>
              <Skeleton.Image active className={css.customSkeletonImage} />
            </div>
          </div>

          {/* Actions */}
          <Flex gap="1rem" style={{ marginTop: "1rem" }}>
            <Skeleton.Button active shape="round" style={{ width: 80 }} />
            <Skeleton.Button active shape="round" style={{ width: 80 }} />
          </Flex>

          {/* Comments Preview */}
          <div style={{ marginTop: "1rem" }}>
            <Flex align="center" gap="0.5rem">
              <Skeleton.Avatar active size={32} shape="circle" />
              <Skeleton.Input active size="small" style={{ width: 180 }} />
            </Flex>
            <Skeleton.Input active size="small" style={{ width: "90%", marginTop: "0.5rem" }} />
          </div>
        </div>
      </Box>
    </div>
  );
};

export default PostSkeleton;
