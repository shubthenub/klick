"use client";
import { useState, useEffect, useContext, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "antd/es/avatar/avatar";
import { Spin, Input, Flex } from "antd";
import { SettingsContext } from "@/context/settings/settings-context";
import css from "@/styles/messages.module.css";
import { useAuth } from "@clerk/nextjs";
import { useMessagesLayoutData, useSearchFollowers } from "@/hooks/useMessagesLayout";
import useWindowsDimension from "@/hooks/useWindowsDimension";
import { useLastMessages } from "@/hooks/useLastMessages";
import { useQueryClient } from "@tanstack/react-query";
import { IoCheckmarkSharp } from "react-icons/io5";
import { getMediaType } from "@/hooks/useMessages";
import FollowerChatListSkeleton from "@/components/FollowerChatListSkeleton";

// ===== Helper: Get last message from cache if available =====
function getLastMessageFromCache(queryClient, chatId) {
  const cache = queryClient.getQueryData(['messages', chatId]);
  if (!cache || !cache.pages || cache.pages.length === 0) return null;
  const allMessages = cache.pages.flatMap(page => page.messages);
  if (allMessages.length === 0) return null;
  return allMessages[allMessages.length - 1];
}

// ===== Helper: Get sidebar last message (cache first, then DB) =====
function getSidebarLastMessage(queryClient, chatId, lastMessagesData) {
  const cachedLast = getLastMessageFromCache(queryClient, chatId);
  if (cachedLast) return cachedLast;
  return lastMessagesData?.[chatId] || null;
}

function truncateText(text, maxLength = 15) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

const Layout = ({ children }) => {
  const { settings, onlineUsers , pusherClient, userChannel} = useContext(SettingsContext);
  const isDark = settings.theme === "dark";
  const pathname = usePathname();
  const parts = pathname?.split("/").filter(Boolean);
  const messagesIndex = parts.indexOf("messages");
  const activeChatId = messagesIndex !== -1 ? parts[messagesIndex + 2] : null;
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const {
    followers,
    isLoading,
    isLoadingFollowers,
    isLoadingChats,
    hasErrors,
    getChatId,
    prefetchUserDetails,
  } = useMessagesLayoutData(userId);

  const { data: lastMessagesData = {}, isLoading: isLoadingLastMessages } = useLastMessages();

  const [activeFollower, setActiveFollower] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFollowers = useSearchFollowers(searchQuery, followers);
  const sortedFilteredFollowers = useMemo(() => {
    return [...filteredFollowers].sort((a, b) => {
      const chatIdA = getChatId(a.follower.id);
      const chatIdB = getChatId(b.follower.id);
      
      const lastMessageA = chatIdA ? getSidebarLastMessage(queryClient, chatIdA, lastMessagesData) : null;
      const lastMessageB = chatIdB ? getSidebarLastMessage(queryClient, chatIdB, lastMessagesData) : null;
      
      const timestampA = lastMessageA?.createdAt ? new Date(lastMessageA.createdAt).getTime() : 0;
      const timestampB = lastMessageB?.createdAt ? new Date(lastMessageB.createdAt).getTime() : 0;
      
      return timestampB - timestampA; // Most recent first
    });
  }, [filteredFollowers, queryClient, lastMessagesData, getChatId]);

  const { width } = useWindowsDimension();
  const [isChatting, setIsChatting] = useState(false);

  useEffect(() => {
    followers.forEach(({ follower }) => {
      if (follower.id) prefetchUserDetails(follower.id);
    });
  }, [followers, prefetchUserDetails]);

  useEffect(() => {
    const parts = pathname?.split("/").filter(Boolean);
    const messagesIndex = parts.indexOf("messages");
    const followerIdFromPath = messagesIndex !== -1 ? parts[messagesIndex + 1] : null;

    if (followerIdFromPath) {
      if (activeFollower !== followerIdFromPath) setActiveFollower(followerIdFromPath);
      if (!isChatting) setIsChatting(true);
    } else {
      if (activeFollower !== null) setActiveFollower(null);
      if (isChatting) setIsChatting(false);
    }
    // eslint-disable-next-line
  }, [pathname]);

  const activateFollower = (followerId) => {
    setActiveFollower(followerId);
  };

  // === PUSHER: Background message and like updates ===
  useEffect(() => {
    if (!pusherClient || !userId) return;

    // const userChannel = pusherClient.subscribe(`private-user-${userId}`);
    // console.log("subscribed to private user channel", `private-user-${userId}`)

    // Handle new message in background (not in active chat)
    const handleBackgroundMessage = (data) => {
      const { message } = data;
      const chatId = message.chatId;

      // Update lastMessages cache for sidebar
      queryClient.setQueryData(['lastMessages', userId], (old) => {
        if (!old) return { [chatId]: message };
        return {
          ...old,
          [chatId]: message,
        };
      });

      // Optionally, update messages cache for preview (if you want to show the message in chat preview before opening)
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;
        // Check for duplicate
        const alreadyExists = old.pages.some(page =>
          page.messages.some(msg => msg.id === message.id)
        );
        if (alreadyExists) return old;
        // Add message to the first page (most recent messages)
        const newPages = [...old.pages];
        if (newPages.length > 0) {
          newPages[0] = {
            ...newPages[0],
            messages: [
              ...newPages[0].messages,
              message
            ],
          };
        }
        return { ...old, pages: newPages };
      });
    };

    // Handle like update in background
    const handleLikeUpdate = ({ messageId, likes, chatId }) => {
      console.log(queryClient.getQueryData(['messages', chatId]))
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            messages: page.messages.map(msg =>
              msg.id === messageId ? { ...msg, Like: likes } : msg
            ),
          })),
        };
      });
    };

    const handleSeenUpdate = ({ messageId, seenBy, chatId }) => {
    // Update messages cache for the specific chat
    queryClient.setQueryData(['messages', chatId], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map(page => ({
          ...page,
          messages: page.messages.map(msg =>
            msg.id === messageId ? { ...msg, seen: true, toBeSeen: false } : msg
          ),
        })),
      };
    });

    // Update lastMessages cache for sidebar
    queryClient.setQueryData(['lastMessages', userId], (old) => {
      if (!old) return old;
      if (!old[chatId]) return old;
      if (old[chatId].id === messageId) {
        return {
          ...old,
          [chatId]: {
            ...old[chatId],
            seen: true,
          },
        };
      }
      return old;
    });
  };
    userChannel.bind("message-seen", handleSeenUpdate);
    userChannel.bind("background-message", handleBackgroundMessage);
    userChannel.bind("message-like-updated", handleLikeUpdate);

    return () => {
      userChannel.unbind("background-message", handleBackgroundMessage);
      userChannel.unbind("message-like-updated", handleLikeUpdate);
      userChannel.unbind("message-seen", handleSeenUpdate);
      // pusherClient.unsubscribe(`private-user-${userId}`);
    };
  }, [pusherClient, userId, queryClient]);

  const canRenderFollowers = !isLoading && filteredFollowers.length > 0;
  const isLoadingData = isLoadingFollowers || isLoadingChats;

  return (
    <div
      className={css.container}
      style={{
        backgroundColor: isDark ? "rgb(0,0,0)" : "#fff",
        color: isDark ? "#fff" : "#000",
        overflow: "hidden",
        height: "100dvh",
      }}
    >
      <div
        className={css.leftcontainer}
        style={{
          borderRight: `${width > 450 ? "1px" : "0px"} solid ${isDark ? "#333" : "#e1e1e1"}`,
          backgroundColor: isDark ? "rgb(0,0,0)" : "#fff",
          width: ((width < 800 && width > 450 && isChatting) || (width > 450 && width < 650 && !isChatting)) ? "84px" : (width < 450 && isChatting) ? "0px" : (width < 450 && !isChatting) ? "100vw" : "300px",
        }}
      >
        <div
          className={css.followerSearch}
          style={{
            backgroundColor: isDark ? "rgb(0,0,0)" : "#fff",
            padding: "10px",
            display: ((width < 800 && isChatting )|| (width<650 && !isChatting)) ? "none" : "flex",
          }}
        >
          <Input.Search
            placeholder="Search followers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>

        {isLoadingData ? (
          <FollowerChatListSkeleton/>
        ) : hasErrors ? (
          <div style={{ padding: "1rem", textAlign: "center" }}>
            <p style={{ color: "#ff4d4f" }}>Error loading data. Please try again.</p>
          </div>
        ) : !canRenderFollowers ? (
          <div style={{ padding: "1rem", textAlign: "center" }}>
            {searchQuery && (
              <p style={{ color: isDark ? "#ccc" : "#666" }}>
                Follow more users to start conversations!
              </p>
            )}
            {isLoading && <FollowerChatListSkeleton/>}
          </div>
        ) : (
          <div className={css.followerList}>
            {sortedFilteredFollowers.map(({ follower }) => {
              const followerId = follower.id;
              const isActive = followerId === activeFollower;
              const chatId = getChatId(followerId);

              // ===== Use cache as single source of truth for last message =====
              const lastMessage = chatId
                ? getSidebarLastMessage(queryClient, chatId, lastMessagesData)
                : null;

              // Show yellow dot and highlight if last message is unseen and chat is inactive
              const hasUnseen = lastMessage && !lastMessage.seen && !isActive && lastMessage.senderId !== userId;
              // Show tick if last message is seen and sent by follower (or by anyone, if you want)
              const showTick = lastMessage && lastMessage.seen && lastMessage.senderId === userId;
              // console.log("Sidebar lastMessage", lastMessage);
              return (
                <Link
                  key={followerId}
                  href={`/messages/${followerId}/${chatId}`}
                  onClick={() => activateFollower(followerId)}
                  className={`${css.followerItem} ${isActive ? css.activeFollower : ""}`}
                  style={{
                    backgroundColor: isActive
                      ? isDark
                        ? "rgb(29 29 29)"
                        : "#f1f1f1"
                      : "transparent",
                    overflow: "hidden",
                  }}
                >
                  <div className={css.followerAvatar} style={{ position: "relative" }}>
                    <Avatar size={40} src={follower.image_url} alt={follower.username} />
                    {onlineUsers.includes(followerId) && (
                      <span
                        className={css.onlineIndicator}
                        style={{
                          backgroundColor: "#00ff00",
                          position: "absolute",
                          bottom: "5%",
                          right: "1px",
                          height: "7px",
                          width: "7px",
                          borderRadius: "50%",
                        }}
                      ></span>
                    )}
                  </div>
                  <div
                    className={css.followerInfo}
                    style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      
                      <h3 style={{ color: isDark ? "white" : "black", margin: 0 }}>{follower.username}</h3>
                      <Flex align="center"  gap={"0.5rem"}>
                      
                      {/* Last message preview */}
                      <p className={css.lastMessage} style={{ color: hasUnseen
                ? (isDark ? "#fff" : "#000")
                : (isDark ? "#828282" : "#6c757d"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0, fontSize: "0.8rem",fontWeight: "500" }}>
                        {lastMessage
                          ? (lastMessage.type === "MEDIA" && getMediaType(lastMessage.content) === "image")
                            ? (lastMessage.senderId === userId) ? "you: 📷 Photo" : "📷 Photo"
                          : (lastMessage.type === "MEDIA" && getMediaType(lastMessage.content) === "video")
                            ? (lastMessage.senderId === userId) ? "you: 📹 Video" : "📹 Video"
                          : (lastMessage.type === "SHARED_POST")
                            ? (lastMessage.senderId === userId)
                              ? `you: post by ${lastMessage.sharedPost?.author?.username || 'unknown'}`
                              : `post by ${lastMessage.sharedPost?.author?.username || 'unknown'}`
                          : (lastMessage.senderId === userId)
                            ? `you: ${truncateText(lastMessage.content)}`
                            : truncateText(lastMessage.content)
                          : "No messages yet"}
                      </p>
                      {/* Show tick if last message is seen and sent by follower */}
                      {showTick && (
                        <IoCheckmarkSharp style={{ color: "#ffaa00ff", marginRight: "0.25rem", fontSize: "1rem" , paddingTop:"0.2rem"}} />
                      )}
                      </Flex>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                      {lastMessage?.createdAt && (
                        <span style={{ fontSize: "0.75rem", color: isDark ? "#666" : "#999" }}>
                          {new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {hasUnseen && (
                        <div style={{
                          backgroundColor: "#e9a847ff",
                          color: "white",
                          borderRadius: "50%",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                          width: "9px",
                          height: "9px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          {/* {unreadCount > 99 ? "99+" : unreadCount} */}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className={css.rightcontainer} style={{ backgroundColor: isDark ? "rgb(0,0,0)" : "#fff", display: (width < 450 && !isChatting) ? "none" : "block" }}>
        {children}
      </div>
    </div>
  );
};

export default Layout;