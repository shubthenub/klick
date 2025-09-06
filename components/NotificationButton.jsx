// NotificationButton.jsx
"use client";

import React, { useEffect, useRef, useState, useContext } from "react";
import { Button, Spin } from "antd";
import { LoadingOutlined } from '@ant-design/icons';
import { IoNotifications } from "react-icons/io5";
import { useUser } from "@clerk/nextjs";
import { useInfiniteQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import pusher from "@/lib/pusher";
import { SettingsContext } from "@/context/settings/settings-context";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import VideoThumbnail from "./VideoThumbnail";
dayjs.extend(relativeTime);

const NotificationButton = () => {
  const { user } = useUser();
  const { notificationChannel, openPostModal, settings: { theme } } = useContext(SettingsContext);
  const [showNotifications, setShowNotifications] = useState(false);
  const queryClient = useQueryClient();
  const listRef = useRef(null);

  // Define theme-dependent styles
  const dropdownStyles = {
    dark: {
      backgroundColor: "rgba(20, 19, 19, 0.85)",
      border: "1px solid rgb(49 45 45)",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
      color: "#f1f1f1",
    },
    light: {
      backgroundColor: "rgba(255, 255, 255, 0.85)",
      border: "1px solid rgb(220 220 220)",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
      color: "#222",
    },
  };

  const notificationItemStyles = {
    dark: {
      isRead: { backgroundColor: "#1e1e1e", color: "#fff" },
      notRead: { backgroundColor: "#292929", color: "#fff" },
      subText: { color: "#bbb" },
    },
    light: {
      isRead: { backgroundColor: "#f8f8f8", color: "#222" },
      notRead: { backgroundColor: "#e8e8e8", color: "#222" },
      subText: { color: "#555" },
    },
  };

  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: async () => {
      const res = await fetch(`/api/notification/unreadCount`);
      const data = await res.json();
      return data?.count || 0;
    },
    enabled: !!user?.id,
  });

  const fetchNotifications = async ({ pageParam = null }) => {
    const res = await fetch(
      `/api/notification?take=10${pageParam ? `&cursor=${pageParam}` : ""}`
    );
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return res.json();
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["notification"],
    queryFn: fetchNotifications,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled: !!user?.id,
  });

  function isVideo(url) {
    return /\.(mp4|webm|ogg)$/i.test(url) || url?.startsWith("data:video/");
  }

  function isImage(url) {
    return /\.(jpeg|jpg|gif|png|webp|avif)$/i.test(url) || url?.startsWith("data:image/");
  }

  useEffect(() => {
    if (showNotifications) {
      fetch("/api/notification/markRead", { method: "POST" }).then(() => {
        // refetchUnreadCount();
      });
    }
  }, [showNotifications]);

  useEffect(() => {
    if (!user?.id || !notificationChannel) return;

    const handleNewNoti = (newNoti) => {
      queryClient.setQueryData(["notification"], (oldData) => {
        if (!oldData) return;

        const updatedPages = [...oldData.pages];

        if (newNoti.deleted && newNoti.id) {
          for (let i = 0; i < updatedPages.length; i++) {
            updatedPages[i] = {
              ...updatedPages[i],
              notifications: updatedPages[i].notifications.filter(
                (noti) => noti.id !== newNoti.id
              ),
            };
          }
          return { ...oldData, pages: updatedPages };
        }

        updatedPages[0] = {
          ...updatedPages[0],
          notifications: [newNoti, ...updatedPages[0].notifications],
        };

        return { ...oldData, pages: updatedPages };
      });

      refetchUnreadCount();
    };

    notificationChannel.bind("new-noti", handleNewNoti);
    return () => notificationChannel.unbind("new-noti", handleNewNoti);
  }, [notificationChannel, user?.id, queryClient]);

  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const isBottom = scrollTop + clientHeight >= scrollHeight - 10;
    if (isBottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const notifications =
    data?.pages.flatMap((page) => page.notifications) || [];

  const currentDropdownStyles = dropdownStyles[theme] || dropdownStyles.dark;
  const currentNotiItemStyles = notificationItemStyles[theme] || notificationItemStyles.dark;

  return (
    <div className="notiButton" ref={dropdownRef} style={{ position: "relative" }}>
      <Button
        type="text"
        aria-label="Notifications"
        style={{ color: "inherit", fontSize: "1.5rem", padding: "0px" }}
        onClick={() => {
          setShowNotifications((prev) => !prev);
          queryClient.setQueryData(["unreadCount"], 0); // Optimistically set to 0
        }}
      >
        <IoNotifications size={24} />
      </Button>

      {unreadCountData > 0 && (
        <span
          className="notiCount"
          style={{
            position: "absolute",
            top: 0,
            right: "0.1rem",
            backgroundColor: "#e3c059",
            borderRadius: "50%",
            color: "#8c2929",
            padding: "0px 6px",
            fontSize: "11px",
            fontWeight: "700",
          }}
        >
          {unreadCountData}
        </span>
      )}

      <div
        className="Notifications"
        ref={listRef}
        onScroll={handleScroll}
        style={{
          ...currentDropdownStyles,
          position: "absolute",
          top: "90%",
          left: "-208%",
          transform: "translate(-50%, 10px)",
          width: "50vw",
          maxWidth: "400px",
          minWidth: "300px",
          height: "45vh",
          backdropFilter: "blur(12px)",
          borderRadius: "10px",
          zIndex: 1001,
          opacity: showNotifications ? 1 : 0,
          pointerEvents: showNotifications ? "auto" : "none",
          transition: "transform 0.3s ease, opacity 0.3s ease",
          padding: "12px",
          overflowY: "auto",
        }}
      >
        <h3 style={{ color: currentDropdownStyles.color, marginBottom: "12px" }}>Notifications</h3>

        {isLoading && <Spin indicator={<LoadingOutlined spin />} size="small" />}
        {!isLoading && notifications.length === 0 && (
          <p style={{ color: "gray", textAlign: "center" }}>No notifications yet.</p>
        )}

        {notifications.map((noti) => {
          const time = dayjs(noti.createdAt);
          const now = dayjs();
          const diffDays = now.diff(time, "day");
          const formattedTime = diffDays > 7 ? time.format("DD/MM/YYYY") : time.fromNow();
          const firstMediaSrc = noti.post?.media?.[0]?.src;
          const postText = noti.post?.postText?.trim() || "";
          const postWords = postText.split(" ");
          const postPreview = postWords.length > 4
            ? postWords.slice(0, 4).join(" ") + "..."
            : postText;
          const commentText = noti.comment?.comment?.trim() || "";
          const commentWords = commentText.split(" ");
          const commentPreview = commentWords.length > 4
            ? commentWords.slice(0, 4).join(" ") + "..."
            : commentText;

          const preview = firstMediaSrc ? (
            isVideo(firstMediaSrc) ? (
              <VideoThumbnail
                src={firstMediaSrc}
                width={40}
                height={40}
                style={{ borderRadius: "4px", marginLeft: "8px" }}
              />
            ) : (
              <img
                src={firstMediaSrc}
                alt="preview"
                style={{
                  width: "40px",
                  height: "40px",
                  objectFit: "cover",
                  borderRadius: "4px",
                  marginLeft: "8px",
                }}
              />
            )
          ) : (
            <span
              style={{
                color: "#aaa",
                marginLeft: "8px",
                fontStyle: "italic",
                whiteSpace: "nowrap",
              }}
            >
              {postPreview}
            </span>
          );

          return (
            <div
              key={noti.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                padding: "10px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                ...currentNotiItemStyles[noti.isRead ? 'isRead' : 'notRead'],
              }}
              onClick={() => {
                if (noti?.postId) {
                  openPostModal(noti.postId);
                  setShowNotifications(false);
                } else {
                  console.error("No postId found in notification:", noti);
                }
              }}
            >
              <div style={{ flex: 1 }}>
                <strong>{noti.fromUser.username}</strong>: {noti.message}
                {noti.comment && (
                  <div
                    style={{
                      fontSize: "10px",
                      marginTop: "4px",
                      maxWidth: "180px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      ...currentNotiItemStyles[noti.isRead ? 'isRead' : 'notRead'].subText,
                    }}
                  >
                    “{commentPreview}”
                  </div>
                )}
                <div
                  style={{
                    fontSize: "10px",
                    marginTop: "4px",
                    ...currentNotiItemStyles[noti.isRead ? 'isRead' : 'notRead'].subText,
                  }}
                >
                  {formattedTime}
                </div>
              </div>
              {preview}
            </div>
          );
        })}

        {isFetchingNextPage && (
          <div style={{ textAlign: "center", padding: "10px" }}>
            <Spin indicator={<LoadingOutlined spin />} size="small" />
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationButton;