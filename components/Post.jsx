import React from "react";
import css from "@/styles/post.module.css";
import { Avatar, Flex, Typography } from "antd";
import Box from "./Box/Box";
import dayjs from "dayjs";
import { getFileTypeFromUrl } from "@/utils";
import LikeButton from "./LikeButton";
import CommentButton from "./CommentButton";
import CommentsSection from "./CommentsSection";
import Link from "next/link";
const Post = ({ data , queryId}) => {
  console.log(data) 
  return (
    <div className={css.wrapper}>
      <Box>
        <div className={css.container}>
          {/* profile info */}
          <Flex align="center" justify="space-between">
            {/* left side = profile info */}
            <Flex gap={".5rem"} align="center">
              <Link
              passHref
              href={`/profile/${data?.author?.id}?person=${data?.author?.first_name}`}>
              
              <Avatar
                size={40}
                src={data?.author?.image_url}
                crossOrigin="anonymous"
              />
              
              </Link>
              {/* name and post date */}
              <Flex vertical>
                <Typography className="typoSubtitle2">
                  {data?.author?.first_name} {data?.author?.last_name}
                </Typography>
                <Typography.Text
                  className="typoCaption"
                  type="secondary"
                  strong
                >
                  {dayjs(data?.createdAt).format("MMM DD, YYYY")}
                </Typography.Text>
              </Flex>
            </Flex>
          </Flex>

          {/* caption */}
          <Typography.Text>
            <div
              dangerouslySetInnerHTML={{
                __html: data?.postText?.replace(/\n/g, "<br>"),
              }}
            />
          </Typography.Text>

          {/* post media part */}
          {
            getFileTypeFromUrl(data?.media) === "image" && (
              <div className={css.media}>
              <img
                src={data?.media}
                alt="post media"
                className={css.media}
                style={{objectFit: "cover",width: "100%",height: "auto"}}
                crossOrigin="anonymous"
                
              />
              </div>
            )
          }
          {
            getFileTypeFromUrl(data?.media) === "video" && (
              <div className={css.media}>
              <video
                autoPlay
                src={data?.media}
                alt="post media"
                className={css.media}
                style={{objectFit: "cover",width: "100%",height: "auto"}}
                controls
                crossOrigin="anonymous"
              />
              </div>
            )
          }
          {/* actions */}
          <Flex>
            <LikeButton
              postId={data?.id}
              likes={data?.likes}
              queryId={queryId}
            />
            {/* <CommentButton/> */}
            <CommentButton
              comments={data?.comments.length}
            />
          </Flex>
          {/* comments section */}
          <CommentsSection
            comments={data?.comments}
            postId={data?.id}
            queryId={queryId}
          />
        </div>
      </Box>
    </div>
  );
};

export default Post;
