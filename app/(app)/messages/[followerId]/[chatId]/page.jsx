"use client";

import React, { useEffect, useState, useRef, useContext, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Flex, Input, Image, Spin, Avatar } from "antd";
import { Icon } from "@iconify/react";
import EmojiPicker from "emoji-picker-react";
import { v4 as uuidv4 } from "uuid";
import { IoCheckmarkSharp } from "react-icons/io5";
import { PiArrowBendDownRightBold, PiArrowBendUpLeftBold } from "react-icons/pi";
import { LoadingOutlined } from "@ant-design/icons";

import css from "@/styles/chatpage.module.css";
import { SettingsContext } from "@/context/settings/settings-context";
import { initializePusher } from "@/utils/initializePusher";
import silentRefresh from "@/utils/silentRefresh";
import { useMessages, useSendMessage, useOptimisticMessage, getMediaType } from "@/hooks/useMessages";
import { useUserDetails } from "@/hooks/useMessagesLayout";
import { useLastMessagesManager, useUnreadCountsManager } from "@/hooks/useLastMessages";

import SeenWrapper from "@/components/SeenWrapper";
import MediaUploadButton from "@/components/MediaUploadButton";
import LikeButton from "@/components/LikeButton";
import SharedPostPreview from "@/components/SharedPostPreview";
import TypingDots from "@/components/TypingDots";

export default function ChatPage() {
  // =================================================================
  // 1. Hooks, State, and Refs
  // =================================================================
  const { followerId, chatId } = useParams();
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const {
    settings,
    pusherClient,
    setPusherClient,
    setOnlineUsers,
    onlineUsers,
    updateLastMessage,
    seenItems,
    markSeen,
    setSeenItems,
    setNotifcationChannel,
    dmChannelsRef,
  } = useContext(SettingsContext);

  const [isTyping, setIsTyping] = useState(false);
  const [text, setText] = useState("");
  const [pendingMedia, setPendingMedia] = useState([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [replyToId, setReplyToId] = useState(null);
  const [seenMessages, setSeenMessages] = useState(() => new Set());
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const seenEventBufferRef = useRef([]);
  const emojiOpenRef = useRef(null);
  const hasScrolledInitially = useRef(false);
  const topRef = useRef(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useMessages(followerId, chatId, { enabled: !!chatId });
  const sendMessageMutation = useSendMessage();
  const { addOptimisticMessage, updateMessageStatus } = useOptimisticMessage(chatId);
  const { updateLastMessage: updateCachedLastMessage } = useLastMessagesManager();
  const { resetUnreadCount, incrementUnreadCount } = useUnreadCountsManager();
  const { data: receiver, isLoading: isLoadingReceiver } = useUserDetails(followerId);
  const isDark = settings.theme === "dark";

  // =================================================================
  // 2. Helper Functions & Memoized Values
  // =================================================================
  const normalizeMessage = (msg) => ({
    id: String(msg.id),
    chatId: String(msg.chatId),
    senderId: String(msg.senderId),
    content: msg.content,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
    replyToId: msg.replyToId ?? null,
    type: msg.type ?? "TEXT",
    sharedPostId: msg.sharedPostId ?? null,
    replyTo: msg.replyTo ?? null,
    sharedPost: msg.sharedPost ?? null,
    Like: Array.isArray(msg.Like) ? msg.Like : [],
    seen: !!msg.seen,
    toBeSeen: typeof msg.toBeSeen === "boolean" ? msg.toBeSeen : !msg.seen,
  });

  function processSeenBuffer(chatId, queryClient, seenEventBufferRef, normalizeMessage) {
    if (!chatId || seenEventBufferRef.current.length === 0) return;

    seenEventBufferRef.current = seenEventBufferRef.current.filter(event => {
      let applied = false;
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => {
            const idx = page.messages.findIndex(m => String(m.id) === event.messageId);
            if (idx !== -1) {
              const newMessages = [...page.messages];
              newMessages[idx] = normalizeMessage
                ? normalizeMessage({ ...newMessages[idx], seen: true, toBeSeen: false })
                : { ...newMessages[idx], seen: true, toBeSeen: false };
              applied = true;
              return { ...page, messages: newMessages };
            }
            return page;
          }),
        };
      });
      return !applied;
    });
  }

  const allSeenMessageIds = useMemo(() => {
    if (!data?.pages) return new Set();
    const allSeenIds = new Set();
    data.pages.forEach(page => {
      if (page.seenMessageIds) {
        page.seenMessageIds.forEach(id => allSeenIds.add(id));
      }
    });
    return allSeenIds;
  }, [data]);

  const messages = useMemo(() => {
    if (!data?.pages) return [];
    const reversedPages = [...data.pages].reverse();
    return reversedPages.flatMap(page => {
      const parsed = page.messages.map((msg) => {
        const mediaType = getMediaType(msg.content);
        const isFromCurrentUser = msg.senderId === userId;
        return {
          ...msg,
          type: mediaType === "text" ? msg.type || "TEXT" : "media",
          mediaFormat: mediaType !== "text" ? mediaType : undefined,
          toBeSeen: isFromCurrentUser ? false : !allSeenMessageIds.has(msg.id),
        };
      });
      return parsed;
    });
  }, [data, userId, allSeenMessageIds]);

  const findMessageById = (id) => {
    return messages.find((msg) => msg.id === id);
  };

  const scrollToMessage = (messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      messageElement.style.backgroundColor = isDark ? "#404040" : "#ffffcc";
      setTimeout(() => {
        messageElement.style.backgroundColor = "";
      }, 2000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setUnreadCount(0);
    if (chatId) {
      resetUnreadCount(chatId);
    }
  };

  const formatDateSeparator = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = messageDate.toDateString() === today.toDateString();
    const isYesterday = messageDate.toDateString() === yesterday.toDateString();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";

    return messageDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const shouldShowDateSeparator = (currentMsg, previousMsg) => {
    if (!previousMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const previousDate = new Date(previousMsg.createdAt).toDateString();
    return currentDate !== previousDate;
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;

    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    setShowScrollButton(!isNearBottom);

    if (isNearBottom) {
      setUnreadCount(0);
      if (chatId) {
        resetUnreadCount(chatId);
      }
    }

    if (scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
      const prevScrollHeight = scrollContainerRef.current.scrollHeight;
      fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight;
            const scrollDiff = newScrollHeight - prevScrollHeight;
            scrollContainerRef.current.scrollTop = scrollTop + scrollDiff;
          }
        });
      });
    }
  };

  let canSendTyping = true;
  const sendTypingEvent = () => {
    if (!canSendTyping) return;
    canSendTyping = false;
    fetch("/api/pusher/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, userId }),
    });
    setTimeout(() => { canSendTyping = true; }, 1000);
  };

  const handleInputChange = (e) => {
    setText(e.target.value);
    sendTypingEvent();
  };
  
  const sendMessage = async () => {
    if (!chatId) return;

    // Don't send if media is still uploading
    if (isUploadingMedia) return;

    // Check if any pending media is still uploading (data URLs)
    const hasUploadingMedia = pendingMedia.some(media => media.isUploading || media.url.startsWith('data:'));
    if (hasUploadingMedia) return;

    const localReplyToId = replyToId;
    let replyTo = null;
    if (localReplyToId) {
      const original = findMessageById(localReplyToId);
      if (original) {
        replyTo = {
          id: original.id,
          content: original.content,
          senderId: original.senderId,
        };
      }
    }
    setReplyToId(null);

    const trimmedText = text.trim();
    const hasMedia = pendingMedia.length > 0;
    const hasText = trimmedText.length > 0;

    if (!hasMedia && !hasText) return;

    const mediaToSend = [...pendingMedia];
    setPendingMedia([]);
    setText("");

    if (hasMedia) {
      for (const media of mediaToSend) {
        // Skip if it's still a data URL (shouldn't happen but safety check)
        if (media.url.startsWith('data:')) {
          console.warn('Attempted to send data URL, skipping:', media);
          continue;
        }
        
        const msgMediaId = uuidv4();
        const optimisticMessage = {
          id: msgMediaId,
          chatId,
          senderId: userId,
          content: media.url,
          type: "MEDIA",
          status: "pending",
          createdAt: new Date().toISOString(),
          replyToId: localReplyToId,
          replyTo: replyTo,
          mediaFormat: media.type,
          seen: false,
        };
        addOptimisticMessage(optimisticMessage);
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        }, 50);

        try {
          await sendMessageMutation.mutateAsync({
            followerId,
            messageData: {
              content: media.url,
              type: "MEDIA",
              id: msgMediaId,
              chatId,
              replyToId: localReplyToId,
              replyTo: replyTo,
              seen: false,
            },
          });
        } catch (error) {
          console.error("Failed to send media message:", error);
        }
      }
    }

    if (hasText) {
      const msgId = uuidv4();
      const optimisticMessage = {
        id: msgId,
        chatId,
        senderId: userId,
        content: trimmedText,
        type: "TEXT",
        status: "pending",
        createdAt: new Date().toISOString(),
        replyToId: localReplyToId,
        replyTo: replyTo,
        seen: false,
      };
      addOptimisticMessage(optimisticMessage);
      updateCachedLastMessage(chatId, {
        id: optimisticMessage.id,
        content: optimisticMessage.content,
        senderId: optimisticMessage.senderId,
        createdAt: optimisticMessage.createdAt,
        type: optimisticMessage.type,
      });
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, 50);

      try {
        await sendMessageMutation.mutateAsync({
          followerId,
          messageData: {
            content: trimmedText,
            type: "TEXT",
            id: msgId,
            chatId,
            replyToId: localReplyToId,
            replyTo: replyTo,
            seen: false,
          },
        });
      } catch (error) {
        console.error("Failed to send text message:", error);
      }
    }
  };
  
  const handleOptimisticLike = (messageId, action) => {
    queryClient.setQueryData(['messages', chatId], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map(page => ({
          ...page,
          messages: page.messages.map(msg => {
            if (msg.id !== messageId) return msg;
            let newLikes = Array.isArray(msg.Like) ? [...msg.Like] : [];
            if (action === "like") {
              if (!newLikes.some(like => like.authorId === userId)) {
                newLikes.push({ authorId: userId });
              }
            } else {
              newLikes = newLikes.filter(like => like.authorId !== userId);
            }
            return { ...msg, Like: newLikes };
          }),
        })),
      };
    });
  };

  // =================================================================
  // 3. useEffect Hooks
  // =================================================================

  useEffect(() => {
    if (data && chatId) {
      processSeenBuffer(chatId, queryClient, seenEventBufferRef, normalizeMessage);
    }
  }, [data, chatId, queryClient]);

  useEffect(() => {
    if (allSeenMessageIds.size > 0) {
      const currentSeenItems = seenItems || [];
      const allSeenIds = [...currentSeenItems, ...Array.from(allSeenMessageIds)];
      setSeenMessages(new Set(allSeenIds));
      setSeenItems(new Set(allSeenIds));
    }
  }, [data, chatId]);
  
  useEffect(() => {
    if (isTyping) {
      scrollToBottom();
    }
  }, [isTyping]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiOpenRef.current && !emojiOpenRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    console.log(replyToId, "replyToId");
  }, [replyToId]);

  useEffect(() => {
    if (messages.length > 0 && !hasScrolledInitially.current) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
          hasScrolledInitially.current = true;
        }
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!chatId || !pusherClient) return;

    const channelName = `private-chat-${chatId}`;
    const channel = pusherClient.subscribe(channelName);

    const handleNewMessage = (incomingMessageRaw) => {
      const incomingMessage = normalizeMessage(incomingMessageRaw);
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => {
            const msgIndex = page.messages.findIndex(msg => String(msg.id) === incomingMessage.id);
            if (msgIndex !== -1) {
              const newMessages = [...page.messages];
              newMessages[msgIndex] = incomingMessage;
              return { ...page, messages: newMessages };
            } else if (page === old.pages[0]) {
              return { ...page, messages: [...page.messages, incomingMessage] };
            } else {
              return page;
            }
          }),
        };
      });
      if (seenEventBufferRef.current.length > 0) {
        seenEventBufferRef.current = seenEventBufferRef.current.filter(event => {
          let applied = false;
          queryClient.setQueryData(['messages', chatId], (old) => {
            if (!old) return old;
            const allIds = old.pages.flatMap(page => page.messages.map(m => String(m.id)));
            if (!allIds.includes(event.messageId)) return old;
            return {
              ...old,
              pages: old.pages.map(page => {
                const idx = page.messages.findIndex(m => String(m.id) === event.messageId);
                if (idx !== -1) {
                  const newMessages = [...page.messages];
                  newMessages[idx] = normalizeMessage({
                    ...newMessages[idx],
                    seen: true,
                    toBeSeen: false,
                  });
                  applied = true;
                  return { ...page, messages: newMessages };
                }
                return page;
              }),
            };
          });
          return !applied;
        });
      }
      updateCachedLastMessage(chatId, {
        id: incomingMessage.id,
        content: incomingMessage.content,
        senderId: incomingMessage.senderId,
        createdAt: incomingMessage.createdAt,
        type: incomingMessage.type,
      });
      if (incomingMessageRaw.senderId !== userId && showScrollButton) {
        setUnreadCount(prev => prev + 1);
        incrementUnreadCount(chatId, 1);
      }
    };

    const handleMessageSeen = ({ messageId, seenBy, chatId }) => {
      messageId = String(messageId);
      let applied = false;
      queryClient.setQueryData(['messages', chatId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => {
            const idx = page.messages.findIndex(m => String(m.id) === messageId);
            if (idx !== -1) {
              const newMessages = [...page.messages];
              newMessages[idx] = normalizeMessage({
                ...newMessages[idx],
                seen: true,
                toBeSeen: false,
              });
              applied = true;
              return { ...page, messages: newMessages };
            }
            return page;
          }),
        };
      });
      if (!applied) {
        seenEventBufferRef.current.push({ messageId, seenBy, chatId });
        processSeenBuffer(chatId, queryClient, seenEventBufferRef, normalizeMessage);
      }
    };

    const handleLikeUpdate = ({ messageId, likes }) => {
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

    const handleTyping = (data) => {
      if (data.userId !== userId) {
        setIsTyping(true);
        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => setIsTyping(false), 2000);
      }
    };

    channel.bind("typing", handleTyping);
    channel.bind("message-like-updated", handleLikeUpdate);
    channel.bind("new-message", handleNewMessage);
    channel.bind("message-seen", handleMessageSeen);
    channel.bind("pusher:subscription_error", async () => {
      console.warn("🔁 Reinitializing Pusher due to subscription error");
      await initializePusher({ setPusherClient, setOnlineUsers, setNotifcationChannel, userId });
    });

    return () => {
      channel.unbind("typing", handleTyping);
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("message-seen", handleMessageSeen);
      channel.unbind("message-like-updated"); // Corrected unbind
    };
  }, [chatId, pusherClient, data]);

  useEffect(() => {
    queryClient.invalidateQueries(['messages', chatId]);
  }, [chatId]);
  
  useEffect(() => {
    console.log("cached data for ['messages', chatId]:", queryClient.getQueryData(['messages', chatId]));
  }, [queryClient, isLoading]);
  
  // useEffect(() => {
  //   silentRefresh(() => {
  //     // React Query will handle refetching automatically
  //   });
  // }, []);

  // =================================================================
  // 4. Render Logic
  // =================================================================

  if (!pusherClient || !userId || isLoading || !chatId) {
    return (
      <div
        className={css.container}
        style={{
          height: "86vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p style={{ color: isDark ? "#ccc" : "#666", marginLeft: "1rem" }}>
          Loading chat... Please wait.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={css.container}
        style={{
          height: "86vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p style={{ color: "#ff4d4f" }}>
          Error loading messages: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div
      className={css.container}
      style={{ height: "86dvh", display: "flex", flexDirection: "column" }}
    >
      <div
        className={css.chatHeader}
        style={{
          padding: "0.75rem",
          borderBottom: `1px solid ${isDark ? "rgb(91, 87, 87)" : "#e1e1e1"}`,
          color: isDark ? "#fff" : "#000",
        }}
      >
        <Flex align="center" gap="1rem">
          <div style={{ position: "relative" }}>
            <Avatar src={receiver?.image_url} size={40} />
            {onlineUsers.includes(receiver?.id) && (
              <span
                className={css.onlineIndicator}
                style={{
                  backgroundColor: "#00ff00",
                  position: "absolute",
                  bottom: "5%",
                  right: "3px",
                  height: "7px",
                  width: "7px",
                  borderRadius: "50%",
                }}
              ></span>
            )}
          </div>
          <div>
            <h3 style={{ margin: 0 }}>
              {receiver?.first_name} {receiver?.last_name}
            </h3>
            <p style={{ margin: 0, color: isDark ? "#ccc" : "#666" }}>
              {receiver?.username || ""}
            </p>
          </div>
        </Flex>
      </div>

      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflowY: "auto", padding: "1rem 1rem 0rem 1rem" }}
      >
        {isFetchingNextPage && (
          <div style={{ textAlign: "center", padding: "1rem" }}>
            <Spin indicator={<LoadingOutlined spin />} size="large" />
            <span style={{ marginLeft: "0.5rem", color: isDark ? "#ccc" : "#666" }}>
              Loading older messages...
            </span>
          </div>
        )}
        {showScrollButton && (
          <div
            style={{
              position: "fixed",
              bottom: "120px",
              right: "30px",
              zIndex: 1000,
            }}
          >
            <Button
              shape="circle"
              size="large"
              onClick={scrollToBottom}
              style={{
                backgroundColor: isDark ? "#333" : "#ffa600ff",
                borderColor: isDark ? "#555" : "#ffa600ff",
                color: "white",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                position: "relative",
              }}
              icon={
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon icon="material-symbols:keyboard-arrow-down" style={{ fontSize: "20px" }} />
                  {unreadCount > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        backgroundColor: "#ff4d4f",
                        color: "white",
                        borderRadius: "50%",
                        fontSize: "12px",
                        fontWeight: "bold",
                        minWidth: "20px",
                        height: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid white",
                      }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </div>
                  )}
                </div>
              }
            />
          </div>
        )}

        {messages.map((msg, i) => {
          const isFromCurrentUser = msg.senderId === userId;
          const nextMessage = messages[i + 1];
          const previousMessage = messages[i - 1];
          const isLastMessageFromFollower =
            !isFromCurrentUser &&
            (!nextMessage || nextMessage.senderId === userId);
          const mediaType = msg.mediaFormat || getMediaType(msg.content);
          const showDateSeparator = shouldShowDateSeparator(msg, previousMessage);
          return (
            <React.Fragment key={`msg-${msg.id}`}>
              {showDateSeparator && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    margin: "1rem 0",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: isDark ? "#2a2a2a" : "#e9ecef",
                      color: isDark ? "#ccc" : "#666",
                      padding: "0.4rem 1rem",
                      borderRadius: "15px",
                      fontSize: "0.8rem",
                      fontWeight: "500",
                    }}
                  >
                    {formatDateSeparator(msg.createdAt)}
                  </div>
                </div>
              )}

              <SeenWrapper
                key={msg.id}
                id={msg.id}
                type="MESSAGE"
                isFromCurrentUser={isFromCurrentUser}
                chatId={chatId}
                seenMessages={seenMessages}
                status={msg.status}
                disabled={isFromCurrentUser}
                senderId={msg.senderId}
              >
                <div
                  id={`message-${msg.id}`}
                  ref={i == 0 ? topRef : null}
                  style={{
                    marginBottom: "0.5rem",
                    display: "flex",
                    gap: "0.5rem",
                    flexDirection: isFromCurrentUser ? "row-reverse" : "row",
                    alignItems: "center",
                    opacity: msg.status === "pending" ? 0.6 : 1,
                    transform: msg.status === "pending" ? "translateX(-5px)" : "none",
                  }}
                >
                  {!isFromCurrentUser &&
                    (isLastMessageFromFollower ? (
                      <Avatar src={receiver?.image_url} size={30} />
                    ) : (
                      <div style={{ width: "30px", height: "1px" }} />
                    ))}

                  <div
                    className="message-container"
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    style={{
                      position: "relative",
                      maxWidth: "65%",
                      display: "flex",
                      flexDirection: isFromCurrentUser ? "row-reverse" : "row",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "1.5rem",
                        backgroundColor: isDark ? "#1a1a1a" : "#f2f2f2",
                        fontSize: "0.95rem",
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                        color: isDark ? "#f2f2f2" : "#1a1a1a",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        justifyContent: "space-between",
                      }}
                    >
                      {msg.replyTo && (
                        <div
                          style={{
                            marginBottom: "0.5rem",
                            padding: "0.5rem",
                            backgroundColor: isDark ? "#2a2a2a" : "#e9e9e9",
                            borderRadius: "8px",
                            fontSize: "0.85rem",
                            color: isDark ? "#ccc" : "#333",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            cursor: "pointer",
                            border: `1px solid ${isDark ? "#333" : "#ddd"}`,
                            transition: "background-color 0.2s ease",
                          }}
                          onClick={() => scrollToMessage(msg.replyTo.id)}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = isDark ? "#333" : "#e0e0e0";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = isDark ? "#2a2a2a" : "#e9e9e9";
                          }}
                        >
                          <span style={{ fontWeight: "600" }}>
                            {msg.replyTo.senderId === userId ? "You" : "Them"}:
                          </span>
                          {(() => {
                            if (msg.replyTo.type === "SHARED_POST" && msg.replyTo.sharedPost) {
                              return (
                                <p style={{ margin: 0, fontStyle: "italic" }}>
                                  {`Post by ${msg.replyTo.sharedPost.author?.username || "Unknown"}`}
                                </p>
                              );
                            }
                            const replyMediaType = getMediaType(msg.replyTo.content);
                            if (replyMediaType === "image") {
                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <Image
                                    src={msg.replyTo.content}
                                    alt="Reply preview"
                                    style={{
                                      width: "40px",
                                      height: "40px",
                                      borderRadius: "6px",
                                      objectFit: "cover",
                                    }}
                                    preview={false}
                                  />
                                  <span style={{ fontStyle: "italic" }}>📷 Photo</span>
                                </div>
                              );
                            } else if (replyMediaType === "video") {
                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <video
                                    src={msg.replyTo.content}
                                    style={{
                                      width: "40px",
                                      height: "40px",
                                      borderRadius: "6px",
                                      objectFit: "cover",
                                    }}
                                  />
                                  <span style={{ fontStyle: "italic" }}>🎥 Video</span>
                                </div>
                              );
                            } else if(msg.replyTo.type==="SHARED_POST" && msg.replyTo.sharedPost) {
                              return (
                                <p style={{ margin: 0, fontStyle: "italic" }}>
                                  {`Post by ${msg.replyTo.sharedPost.author?.username || "Unknown"}`}
                                </p>
                              );
                            }
                            else {
                              return (
                                <p style={{ margin: 0, fontStyle: "italic" }}>
                                  {msg.replyTo.content?.slice(0, 100) || "This message was deleted"}
                                </p>
                              );
                            }
                          })()}
                        </div>
                      )}

                      {(() => {
                        if (msg.type === "SHARED_POST" && msg.sharedPost) {
                          return <SharedPostPreview sharedPost={msg.sharedPost} messageText={msg.content} />;
                        }
                        const mediaType = getMediaType(msg.content);
                        if (mediaType === "image") {
                          return (
                            <Image
                              src={msg.content}
                              alt="Media"
                              style={{
                                maxWidth: "100%",
                                borderRadius: "12px",
                                maxHeight: "200px",
                              }}
                            />
                          );
                        } else if (mediaType === "video") {
                          return (
                            <video
                              src={msg.content}
                              controls
                              style={{
                                maxWidth: "100%",
                                borderRadius: "12px",
                                maxHeight: "200px",
                              }}
                            />
                          );
                        } else {
                          return msg.content;
                        }
                      })()}

                      {isFromCurrentUser && msg.seen && (
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "rgba(237, 159, 4, 1)",
                            position: "absolute",
                            right: "-9px",
                            bottom: "0px",
                            fontWeight: "bold",
                          }}
                        >
                          <IoCheckmarkSharp />
                        </div>
                      )}
                    </div>
                    {(
                      <div style={{ display: "flex", flexDirection: `${(msg.senderId === userId) ? "row-reverse" : "row"}`, gap: "2px", alignItems: "center", padding: "1px" }} >
                        <div style={{ opacity: 1 }}>
                          {(() => {
                            const isLiked = (msg.Like?.length > 0) || msg.localLike;
                            return ((hoveredMessageId === msg.id && !isLiked) || isLiked) && (
                              <LikeButton
                                type="MESSAGE"
                                targetId={msg.id}
                                existingLikes={msg.Like || []}
                                queryKey={["messages", chatId]}
                                showCount={false}
                                size="sm"
                                followerId={followerId}
                                likes={msg.Like || []}
                                entityId={chatId}
                              />
                            );
                          })()}
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#888",
                            cursor: "pointer",
                            opacity: hoveredMessageId === msg.id ? 1 : 0,
                            transition: "opacity 0.2s ease-in-out",
                            paddingTop: "3px"
                          }}
                          onClick={() => setReplyToId(msg.id)}
                        >
                          {isFromCurrentUser ? (
                            <PiArrowBendUpLeftBold />
                          ) : (
                            <PiArrowBendDownRightBold />
                          )}
                        </div>
                      </div>
                    )}
                    {isFromCurrentUser && msg.seen && hoveredMessageId === msg.id && (
                      <div
                        style={{
                          position: "absolute",
                          left: "-100px",
                          top: "55%",
                          transform: "translateY(-50%)",
                          fontSize: "0.75rem",
                          color: "#999",
                          opacity: hoveredMessageId === msg.id ? 1 : 0,
                          transition: "opacity 0.2s ease-in-out",
                          pointerEvents: "none",
                        }}
                      >
                        seen at{" "}
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </SeenWrapper>
            </React.Fragment>
          );
        })}
        {isTyping && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "0.5rem",
              gap: "0.5rem",
              flexDirection: "row",
            }}
          >
            <Avatar src={receiver?.image_url} size={30} />
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "1.5rem",
                backgroundColor: isDark ? "#1a1a1a" : "#f2f2f2",
                minWidth: "48px",
                display: "flex",
                alignItems: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: "0.75rem",
          borderTop: `1px solid ${isDark ? "rgb(91, 87, 87)" : "#e1e1e1"}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {pendingMedia.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "1rem",
              flexWrap: "wrap",
              marginBottom: "0.5rem",
              padding: "0.5rem",
              background: isDark ? "#121212" : "#f9f9f9",
              borderRadius: "8px",
            }}
          >
            {pendingMedia.map((file, index) => (
              <div
                key={index}
                style={{
                  position: "relative",
                  maxWidth: "120px",
                }}
              >
                <span
                  onClick={() =>
                    setPendingMedia((prev) =>
                      prev.filter((_, i) => i !== index)
                    )
                  }
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    background: "#ff4d4f",
                    color: "white",
                    borderRadius: "50%",
                    cursor: "pointer",
                    width: "20px",
                    height: "20px",
                    textAlign: "center",
                    fontSize: "12px",
                    lineHeight: "20px",
                    zIndex: 1,
                  }}
                >
                  ✕
                </span>
                {file.type === "image" ? (
                  <Image
                    src={file.url}
                    alt="preview"
                    style={{
                      borderRadius: "6px",
                      maxWidth: "100%",
                      maxHeight: "100px",
                      opacity: file.isUploading ? 0.5 : 1,
                    }}
                  />
                ) : (
                  <video
                    src={file.url}
                    controls={!file.isUploading}
                    style={{
                      borderRadius: "6px",
                      maxWidth: "100%",
                      maxHeight: "100px",
                      opacity: file.isUploading ? 0.5 : 1,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {replyToId && (
          <div style={{
            marginBottom: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            justifyContent: "space-between",
            padding: "0.5rem",
            backgroundColor: isDark ? "#2a2a2a" : "#f0f0f0",
            borderRadius: "8px",
            borderLeft: `3px solid ${isDark ? "#555" : "#ffbb00ff"}`
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
              {(() => {
                const replyMsg = findMessageById(replyToId);
                if (!replyMsg) return <span>Message not found</span>;

                if(replyMsg.type === "SHARED_POST" && replyMsg.sharedPost) {
                  return (
                    <span>Replying to post by {replyMsg.sharedPost.author?.username || "Unknown"}</span>
                  );
                }
                const replyMediaType = getMediaType(replyMsg.content);
                if (replyMediaType === "image") {
                  return (
                    <>
                      <Image
                        src={replyMsg.content}
                        alt="Reply preview"
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "4px",
                          objectFit: "cover",
                        }}
                        preview={false}
                      />
                      <span>📷 Photo</span>
                    </>
                  );
                } else if (replyMediaType === "video") {
                  return (
                    <>
                      <video
                        src={replyMsg.content}
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "4px",
                          objectFit: "cover",
                        }}
                      />
                      <span>🎥 Video</span>
                    </>
                  );
                } else {
                  return <span>Replying to: {replyMsg.content.slice(0, 30)}</span>;
                }
              })()}
            </div>
            <button
              onClick={() => setReplyToId(null)}
              style={{
                background: "none",
                border: "none",
                color: isDark ? "#ccc" : "#666",
                cursor: "pointer",
                fontSize: "1rem",
                padding: "0.25rem"
              }}
            >
              ✖
            </button>
          </div>
        )}

        <Flex align="center" gap="1rem" style={{ width: "100%" }}>
          <MediaUploadButton
            onPreview={(previews) => {
                // This function sets the local state for immediate preview
                setPendingMedia(previews);
            }}
            onUpload={(uploadedMedia) => {
              // Replace the preview data URLs with actual Cloudinary URLs
              setPendingMedia((prev) => {
                return prev.map((preview) => {
                  const uploaded = uploadedMedia.find(um => um.uploadId === preview.uploadId);
                  return uploaded ? uploaded : preview;
                });
              });
            }}
            onUploadStatusChange={setIsUploadingMedia}
          />
          <div style={{ position: "relative" }} ref={emojiOpenRef}>
            <Button
              icon={<Icon icon="twemoji:smiling-face-with-smiling-eyes" />}
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "1.25rem",
                cursor: "pointer",
              }}
            />
            {showEmojiPicker && (
              <div
                style={{ position: "absolute", bottom: "50px", zIndex: 100, width: "100px" }}
              >
                <EmojiPicker
                  theme={isDark ? "dark" : "light"}
                  onEmojiClick={(emojiData) =>
                    setText((prev) => prev + emojiData.emoji)
                  }
                />
              </div>
            )}
          </div>
          <Input.TextArea
            variant="borderless"
            autoSize={{ minRows: 1, maxRows: 4 }}
            value={text}
            onChange={handleInputChange}
            placeholder="Type a message"
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                sendMessage();
                console.log("Sending message:", text);
              }
            }}
            style={{ resize: "none", flex: 1 }}
          />
          <Button
            type="primary"
            onClick={() => sendMessage()}
            disabled={(
              (!text.trim() && pendingMedia.length === 0) || 
              isUploadingMedia || 
              pendingMedia.some(media => media.isUploading || media.url.startsWith('data:'))
            )}
            icon={<Icon icon="ic:round-send" />}
          />
        </Flex>
      </div>
    </div>
  );
}