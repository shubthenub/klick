import React, { useState, useEffect, useContext } from 'react';
import css from "@/styles/postMenu.module.css";
import { SettingsContext } from '@/context/settings/settings-context';
import { MdDelete } from "react-icons/md";
import { useDeletePost } from '@/hooks/useDeletePost';
import { useUser } from '@clerk/nextjs';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { FaLink } from "react-icons/fa6";

const PostMenu = ({ postId }) => {
  const {
    settings: { theme },
  } = useContext(SettingsContext);

  const menuitems = [
    { icon: <MdDelete />, text: "Delete" },
    { icon: <FaLink />, text: "Copy Link" },
    { icon: <MdDelete />, text: "Delete" },
    { icon: <MdDelete />, text: "Delete" },
  ];

  const { user } = useUser();
  const userId = user?.id;
  const { mutate: deletePostMutation, isPending, isSuccess, isError } = useDeletePost();

  const [menuAction, setMenuAction] = useState(null);
  const [clickedIndex, setClickedIndex] = useState(null);

  const handleMenuAction = (action, index) => {
    if (isPending) return; // prevent multiple clicks
    setMenuAction(action);
    setClickedIndex(index);
  };

  useEffect(() => {
    if (menuAction === "Delete" && userId) {
      deletePostMutation({ postId, userId });
    }
  }, [menuAction]);

  return (
    <div
      className={css.container}
      style={{
        border:
          theme === "dark"
            ? "0.5px solid hsla(0, 1.90%, 42.00%, 0.48)"
            : "0.5px solid rgb(233, 231, 231)",
        backgroundColor: theme === "dark" ? "black" : "white",
      }}
    >
      {menuitems.map((item, index) => (
        <div
          className={css.menuitem}
          key={index}
          onClick={() => handleMenuAction(item.text, index)}
        >
          {item.icon}
          <span>{item.text}</span>
          {isPending && clickedIndex === index && <Spin indicator={<LoadingOutlined spin />} size="large" />}
        </div>
      ))}
    </div>
  );
};

export default PostMenu;
