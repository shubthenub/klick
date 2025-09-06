import React, { useRef } from "react";
import css from "@/styles/post.module.css";
import { Avatar, Flex, Typography } from "antd";
import Box from "./Box/Box";
import dayjs from "dayjs";
import { getFileTypeFromUrl } from "@/utils";
import LikeButton from "./LikeButton";
import CommentButton from "./CommentButton";
import CommentsSection from "./CommentsSection";
import Link from "next/link";
import { BsThreeDotsVertical } from "react-icons/bs";
import { SettingsContext } from "@/context/settings/settings-context";
import { useContext } from "react";
import PostMenu from "./PostMenu";

import Slider from "react-slick";
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";
import { usePostCommentCount } from "@/hooks/usePostCommentCount";

// Custom Carousel Component with proper controls
const CarouselWithCustomControls = ({ data }) => {
  const sliderRef = React.useRef(null);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const totalSlides = data.media.length;
  
  const goToPrev = () => {
    if (sliderRef.current && currentSlide > 0) {
      sliderRef.current.slickPrev();
    }
  };
  
  const goToNext = () => {
    if (sliderRef.current && currentSlide < totalSlides - 1) {
      sliderRef.current.slickNext();
    }
  };
  
  const sliderSettings = {
    dots: true,
    arrows: false,
    infinite: false,
    speed: 300,
    slidesToShow: 1,
    slidesToScroll: 1,
    beforeChange: (current, next) => setCurrentSlide(next),
    adaptiveHeight: true,
  };
  
  return (
    <div className={css.mediaSlider}>
      <Slider ref={sliderRef} {...sliderSettings}>
        {data.media.map((item, idx) => (
          <div key={idx} className={css.media}>
            {getFileTypeFromUrl(item.src) === "image" ? (
              <img
                src={item.src}
                alt={`media-${idx}`}
                className={css.carouselMedia}
              />
            ) : (
              <video
                src={item.src}
                controls
                className={css.carouselMedia}
              />
            )}
          </div>
        ))}
      </Slider>
      
      {/* Smart navigation arrows - only show when navigation is possible */}
      {data.media.length > 1 && (
        <>
          {currentSlide > 0 && (
            <button 
              className={css.prevArrow}
              onClick={goToPrev}
              type="button"
              style={{ opacity: 1 }}
            >
              ‹
            </button>
          )}
          {currentSlide < totalSlides - 1 && (
            <button 
              className={css.nextArrow}
              onClick={goToNext}
              type="button"
              style={{ opacity: 1 }}
            >
              ›
            </button>
          )}
        </>
      )}
    </div>
  );
};

  
  


const Post = ({ data , queryId}) => {
  console.log('📝 Post component received data:', data);
  console.log('📝 Post text:', data?.postText);
  console.log('📝 Post media:', data?.media);
  console.log('📝 Post author:', data?.author);
  const [showMenu , setShowMenu] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const menuButtonRef=useRef(null);
  const handleMenuClick = (event) => {
    event.stopPropagation(); // Prevent event bubbling
    setShowMenu((prev) => !prev);
  };
  // This function will be passed to PostMenu to allow it to close itself
  const handleCloseMenu = () => {
    setShowMenu(false);
  };

  const {
    settings: { theme }, //so that on theme change three dots changes bg color
  } = useContext(SettingsContext);
  const displayCommentCount = usePostCommentCount(data?.id) || data?._count?.comments || 0;
  return (
    <div
      className={`post-container ${isDeleting ? "deleting" : ""}`}
      style={{
        opacity: isDeleting ? 0.5 : 1,
        pointerEvents: isDeleting ? "none" : "auto",
        transition: "opacity 0.3s ease",
      }}>
    <div className={css.wrapper}>
      <Box>
        <div className={css.container} style={{backgroundColor:theme=="dark"?"rgb(17 17 17)":"rgb(248 248 248)"}}>
          {/* profile info */}
          <Flex align="center" justify="space-between" style={{position:"relative", }}>
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
            {/* right side = three dots */}
            
                <PostMenu postId={data?.id} post={data} opac={showMenu?1:0} onClose={handleCloseMenu} menuButtonRef={menuButtonRef}
                onDeleting={(id, status) => {
                  if (id === data.id) setIsDeleting(status);
                }}
                />
              
            <button
              ref={menuButtonRef}
              onClick={handleMenuClick}
              style={{border: "none", cursor: "pointer",height:"1.5rem", width:"1.5rem",background:"transparent",}}
            >
              <BsThreeDotsVertical color={theme=="dark"?"white":"black"} />
            </button>
            
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
          {Array.isArray(data?.media) && data?.media.length > 0 && (
            <div className={css.mediaContainer}>
              {data.media.length === 1 ? (
                // Single media - no carousel needed
                <div className={css.media}>
                  {getFileTypeFromUrl(data.media[0].src) === "image" ? (
                    <img
                      src={data.media[0].src}
                      alt="media"
                      className={css.singleMedia}
                    />
                  ) : (
                    <video
                      src={data.media[0].src}
                      controls
                      className={css.singleMedia}
                    />
                  )}
                </div>
              ) : (
                // Multiple media - use improved carousel
                <CarouselWithCustomControls data={data} />
              )}
              {data.media.length > 1 && (
                <div className={css.mediaCounter}>
                  {data.media.length} files
                </div>
              )}
            </div>
          )}

          {/* actions */}
          <Flex>
            <LikeButton
              targetId={data?.id}
              type="POST"
              existingLikes={data?.likes}
              queryKey={["feed"]}
              showCount={true}
            />
            {/* <CommentButton/> */}
            <CommentButton
              comments={displayCommentCount}
            />
          </Flex>
          {/* comments section */}
          <CommentsSection
            postId={data?.id}
            queryId={queryId}
            // We keep this prop to provide the initial total count,
            // but CommentsSection will fetch its own detailed comment list.
            totalCommentsFromPost={displayCommentCount}
          />
        </div>
      </Box>
    </div>
    </div>
  );
};

export default Post;
