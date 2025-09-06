import React, { useState, useEffect, useContext, use, useRef } from 'react';
import css from "@/styles/postMenu.module.css";
import { SettingsContext } from '@/context/settings/settings-context';
import { MdDelete } from "react-icons/md";
import { FaBookmark, FaLink, FaShare } from "react-icons/fa";
import { useDeletePost } from '@/hooks/useDeletePost';
import { useUser } from '@clerk/nextjs';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import SharePostModal from './SharePostModal';
import toast from 'react-hot-toast';

const PostMenu = ({ postId, post, opac, onClose, menuButtonRef, onDeleting}) => {
  const {
    settings: { theme },
  } = useContext(SettingsContext);
  const { user } = useUser();
  const userId = user?.id;

  const menuitems = [
    { icon: <FaShare />, text: "Share" },
    { icon: <FaBookmark />, text: "Save Post" },
    // { icon: <MdDelete size={"17px"} />, text: "Delete" },
  ];

  if (post && post.authorId === userId) {
    menuitems.push({ icon: <MdDelete size={"17px"} />, text: "Delete" });
  }

  
  const { mutate: deletePostMutation, isPending, isSuccess, isError } = useDeletePost();
  const menuRef = useRef(null);
  const [menuAction, setMenuAction] = useState(null);
  const [clickedIndex, setClickedIndex] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if the click is outside the menu AND not on the button
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    
    // Add event listener only when the menu is open
    if (opac) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    // Clean up the event listener on close
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [opac, onClose, menuButtonRef]);

  const handleShareClick = () => {
    setIsShareModalOpen(true);
  };

  const handleShareModalClose = () => {
    setIsShareModalOpen(false);
    // Reset menuAction when modal closes
    setMenuAction(null);
  };

  const handleMenuAction = (action, index) => {
    if (isPending) return; // prevent multiple clicks
    setMenuAction(action);
    setClickedIndex(index);
    // onClose(); 
  };

  useEffect(() => {
    if (menuAction === "Delete" && userId) {
      onDeleting(postId, true);
      deletePostMutation({ postId, userId }
      );
      setMenuAction(null); // Reset after action
    } else if (menuAction === "Share") {
      handleShareClick();
      // Don't reset menuAction here, let handleShareModalClose do it
    } else if (menuAction === "Save Post") {
      toast.success("Post Saved")
      setMenuAction(null); // Reset after action
    }
  }, [menuAction]);

  const handleShareSuccess = () => {
    // You can add any success handling here
    console.log('Post shared successfully');
  };

  return (
    <>
      <div
        className={css.container}
        ref={menuRef}
        style={{
          backgroundColor: theme === "dark" ? "#1e1e1e" : "#e8e8e8",
          opacity: opac || 0,
          position: "absolute",
          transform: "translate(0%, 0px)",
          transition: "transform 0.2s ease, opacity 0.2s ease",
          display: opac ? "block" : "none",
        }}
      >
        {menuitems.map((item, index) => (
          <div
            className={css.menuitem}
            key={index}
            onClick={() => handleMenuAction(item.text, index)}
          >
            {item.icon} <br />
            <span>{item.text}</span>
            {isPending && clickedIndex === index && <Spin indicator={<LoadingOutlined spin />} size="small" />}
          </div>
        ))}
      </div>

      <SharePostModal
        isOpen={isShareModalOpen}
        onClose={handleShareModalClose}
        post={post} // Changed from postData to post
        onSuccess={handleShareSuccess}
      />
    </>
  );
};

export default PostMenu;