"use client";

import { useEffect, useState, useRef, useContext, use } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@clerk/nextjs";
import css from "@/styles/chatpage.module.css";
import ChatInput from "@/components/ChatInput";
import { Button, Flex, Input, Image } from "antd";
import { Icon } from "@iconify/react";
import Avatar from "antd/es/avatar/avatar";
import { getUser } from "@/actions/user";
import { SettingsContext } from "@/context/settings/settings-context";
import { initializePusher } from "@/utils/initializePusher";
import silentRefresh from "@/utils/silentRefresh";
import MediaUploadButton from "@/components/MediaUploadButton";
import EmojiPicker from "emoji-picker-react";
import { v4 as uuidv4 } from "uuid"; // or use cuid()
import SeenWrapper from "@/components/SeenWrapper";
import { IoCheckmarkSharp } from "react-icons/io5";
import { FaCheck } from "react-icons/fa";
import {
  PiArrowBendDownRightBold,
  PiArrowBendUpLeftBold,
} from "react-icons/pi";

export default function ChatPage() {
  const { followerId } = useParams();
  const [messages, setMessages] = useState([]);
  const [oldestId, setOldestId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const { getToken, userId } = useAuth();
  const [receiver, setReceiver] = useState({});
  const [pendingMedia, setPendingMedia] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiOpenRef = useRef(null);
  const [mediaPreviews, setMediaPreviews] = useState([]); // array of { loading: true } or { url, type }
  const [seenMessages, setSeenMessages] = useState(
    (seenItems) => new Set(seenItems || [])
  );
  const [hovered, setHovered] = useState(false);

  const [replyToId, setReplyToId] = useState(null); // replyTo is the full message object being replied to

  // const handleSeen = (id) => {
  //   setSeenMessages((prev) => new Set(prev).add(id));
  // };
  const findMessageById = (id) => {
    return messages.find((msg) => msg.id === id);
  }

  // useState for emoji picker hiding when outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiOpenRef.current &&
        !emojiOpenRef.current.contains(event.target)
      ) {
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
  } = useContext(SettingsContext);
  const isDark = settings.theme === "dark";

  const hasScrolledInitially = useRef(false);

  useEffect(() => {
    if (!hasScrolledInitially.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      hasScrolledInitially.current = true;
    }
  }, [messages]);

  const getMediaType = (url) => {
    if (/\.(jpeg|jpg|png|gif|webp)$/i.test(url)) return "image";
    if (/\.(mp4|webm|mov)$/i.test(url)) return "video";
    return "text";
  };

  const topRef = useRef(null);
  useEffect(() => {
    console.log(replyToId, "replyToId");
  }, [replyToId]);
  const loadMessages = async (isInitial = false) => {
    if (!followerId || (!isInitial && !hasMore)) return;

    const scrollContainer = scrollContainerRef.current;
    const prevScrollHeight = scrollContainer?.scrollHeight ?? 0;

    try {
      const url = new URL(
        `/api/messages/${followerId}`,
        window.location.origin
      );
      url.searchParams.set("limit", "20");
      if (!isInitial && oldestId) {
        url.searchParams.set("before", oldestId);
      }

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text(); // helpful for debugging
        throw new Error(`Failed to fetch messages. Status: ${res.status}. Response: ${text}`);
      }
      const data = await res.json();
      setChatId(data.chat?.id || null);
      const parsed = data.messages.map((msg) => {
        const mediaType = getMediaType(msg.content);
        return {
          ...msg,
          type: mediaType === "text" ? msg.type || "text" : "media",
          mediaFormat: mediaType !== "text" ? mediaType : undefined,
          toBeSeen: !msg.seen, // ✅ direct from server
        };
      });

      if (isInitial) {
        setMessages(parsed);
      } else {
        setMessages((prev) => [...parsed, ...prev]);
      }

      if (parsed.length > 0) {
        setOldestId(parsed[0].id);
      }
      if (parsed.length < 20) {
        setHasMore(false);
      }

      const apiSeen = new Set(data.seenMessageIds || []);
      const localSeen = new Set(seenItems);
      const combinedSeen = new Set([...apiSeen, ...localSeen]);

      setSeenMessages(combinedSeen);
      setSeenItems(combinedSeen);

      updateLastMessage(
        data.chat?.id,
        data.messages?.[data.messages.length - 1]
      );

      // ⬇ scroll management
      requestAnimationFrame(() => {
        if (isInitial && !hasScrolledInitially.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          hasScrolledInitially.current = true;
        } else if (!isInitial) {
          const newScrollHeight = scrollContainer?.scrollHeight ?? 0;
          const scrollDiff = newScrollHeight - prevScrollHeight;
          scrollContainer.scrollTop += scrollDiff;
        }
      });
      console.log("loaded messages:",parsed)
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!topRef.current || !hasMore) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        loadMessages(false);
      }
    });

    observer.observe(topRef.current);
    return () => observer.disconnect();
  }, [[oldestId, hasMore, messages.length]]);

  const getReceiver = async () => {
    if (!followerId) return;
    const user = await getUser(followerId);
    if (user) setReceiver(user);
  };

  useEffect(() => {
    loadMessages(true);
    getReceiver();
  }, [followerId]);

  useEffect(() => {
    if (!chatId || !pusherClient) return;

    const channelName = `private-chat-${chatId}`;
    const channel = pusherClient.subscribe(channelName);
    console.log("🔔 Subscribed to:", channelName);

    const handleNewMessage = (incomingMessageRaw) => {
      const receivedAt = Date.now();
      if (incomingMessageRaw.sentAt) {
        const latency = receivedAt - incomingMessageRaw.sentAt;
        console.log(`📡 Pusher latency: ${latency} ms`);
      }
      const mediaType = getMediaType(incomingMessageRaw.content);

      const incomingMessage = {
        ...incomingMessageRaw,
        type: incomingMessageRaw.type || (mediaType !== "text" ? "media" : "text"),
        mediaFormat: mediaType !== "text" ? mediaType : undefined,
        createdAt: incomingMessageRaw.createdAt || new Date().toISOString(),
        status: "sent",
      };

      setMessages((prevMessages) => {
        const existingIndex = prevMessages.findIndex((m) => m.id === incomingMessage.id);
        const updated = [...prevMessages];

        if (existingIndex !== -1) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...incomingMessage,
            status: "sent", // ✅ force override
          };
        } else {
          updated.push(incomingMessage);
        }

        return updated
          .slice(-10)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });

    };

    const handleMessageSeen = ({ messageId, seenBy }) => {
      if (seenBy !== userId) {
        setSeenMessages((prev) => new Set(prev).add(messageId));
        setSeenItems((prev) => new Set(prev).add(messageId));
      }
    };

    channel.bind("new-message", handleNewMessage);
    channel.bind("message-seen", handleMessageSeen);
    channel.bind("pusher:subscription_error", async () => {
      console.warn("🔁 Reinitializing Pusher due to subscription error");
      await initializePusher({ setPusherClient, setOnlineUsers });
    });

    return () => {
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("message-seen", handleMessageSeen);
      pusherClient.unsubscribe(channelName);
      console.log("❌ Unsubscribed from:", channelName);
    };
  }, [chatId, pusherClient]);

  const sendMessage = async () => {
    if (!chatId) return;
    console.log(chatId, "chatId ");
    console.log("Sending message");
    hasScrolledInitially.current = false; // Reset scroll state for new messages
    

    //  Cache reply info before clearing
    const localReplyToId = replyToId;
    let replyTo = null;
     if (localReplyToId) {
      const original = findMessageById(localReplyToId, messages);
      if (original) {
        replyTo = {
          id: original.id,
          content: original.content,
          senderId: original.senderId,
        };
      }
    }
    setReplyToId(null); // Clear reply state immediately

    
    const trimmedText = text.trim();
    const hasMedia = pendingMedia.length > 0;
    const hasText = trimmedText.length > 0;

    if (!hasMedia && !hasText) return;

    const mediaToSend = [...pendingMedia];
    setPendingMedia([]);
    setText("");

    const sendPromises = [];

    // Send media messages
    if (hasMedia) {
      for (const media of mediaToSend) {
        const msgMediaId = uuidv4();
        // ... (optimistic UI code remains the same)
        // const tempId = `temp-${Date.now()}-${Math.random()}`;
        const newMessage = {
          id: msgMediaId,
          chatId,
          senderId: userId,
          content: media.url,
          type: "media",
          status: "pending",
          createdAt: new Date().toISOString(),
          replyToId: replyToId ,
          replyTo: replyTo,
        };
        setMessages((prev) => [...prev, newMessage]);
        sendPromises.push(
          fetch(`/api/messages/${followerId}`, {
            method: "POST",
            // credentials: 'include' is crucial. It tells the browser to send cookies.
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              // 3. Authorization header is removed.
            },
            body: JSON.stringify({
              content: media.url,
              type: "media",
              id: msgMediaId,
              chatId,
              replyToId: replyToId,
              replyTo: replyTo,
            }),
          })
        );
        
      }
    }

    // Send text message
    if (hasText) {
      const msgId = uuidv4();
      // ... (optimistic UI code remains the same)
      // const tempId = `temp-${Date.now()}`;
      const newMessage = {
        id: msgId,
        chatId,
        senderId: userId,
        content: trimmedText,
        type: "text",
        status: "pending",
        createdAt: new Date().toISOString(),
        replyToId: replyToId ,
        replyTo: replyTo,
      };
      setMessages((prev) => [...prev, newMessage]);

      sendPromises.push(
        fetch(`/api/messages/${followerId}`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            // 3. Authorization header is removed.
          },
          body: JSON.stringify({
            content: trimmedText,
            type: "text",
            id: msgId,
            chatId,
            replyToId: replyToId,
            replyTo: replyTo,
          }),
        })
      );
    }

    try {
      await Promise.all(sendPromises);
    } catch (err) {
      console.error("One or more messages failed to send:", err);
    } finally {
      // Scroll to the bottom after sending messages
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      hasScrolledInitially.current = true;
    }
  };

  silentRefresh(() => {
    loadMessages(false);
  });

  if (!pusherClient || !userId) {
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
        <p style={{ color: isDark ? "#ccc" : "#666" }}>
          Loading chat... Please wait.
        </p>
      </div>
    );
  }

  return (
    <div
      className={css.container}
      style={{ height: "86vh", display: "flex", flexDirection: "column" }}
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
            <Avatar src={receiver?.data?.image_url} size={40} />
            {onlineUsers.includes(receiver?.data?.id) && (
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
              {receiver?.data?.first_name} {receiver?.data?.last_name}
            </h3>
            <p style={{ margin: 0, color: isDark ? "#ccc" : "#666" }}>
              {receiver?.data?.username || ""}
            </p>
          </div>
        </Flex>
      </div>

      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflowY: "auto", padding: "1rem" }}
      >
        {messages.map((msg, i) => {
          const isFromCurrentUser = msg.senderId === userId;
          const nextMessage = messages[i + 1];
          const isLastMessageFromFollower =
            !isFromCurrentUser &&
            (!nextMessage || nextMessage.senderId === userId);
          const mediaType = msg.mediaFormat || getMediaType(msg.content);

          return (
            <SeenWrapper
              key={msg.id}
              id={msg.id}
              type="MESSAGE"
              isFromCurrentUser={isFromCurrentUser}
              chatId={chatId}
              seenMessages={seenMessages}
              status={msg.status}
              disabled={true}
            >
              <div
                ref={i == 0 ? topRef : null}
                style={{
                  marginBottom: "0.5rem",
                  display: "flex",
                  gap: "0.5rem",
                  flexDirection: isFromCurrentUser ? "row-reverse" : "row",
                  alignItems: "center",
                  opacity: msg.status === "pending" ? 0.6 : 1,
                  transform:
                    msg.status === "pending" ? "translateX(-5px)" : "none",
                }}
              >
                {!isFromCurrentUser &&
                  (isLastMessageFromFollower ? (
                    <Avatar src={receiver?.data?.image_url} size={30} />
                  ) : (
                    <div style={{ width: "30px", height: "1px" }} /> // Placeholder to align message
                  ))}

                <div
                  className="message-container"
                  onMouseEnter={() => setHovered(true)}
                  onMouseLeave={() => setHovered(false)}
                  style={{
                    position: "relative",
                    maxWidth: "50%",
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
                      // alignItems: "center",
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
                        }}
                      >
                        <span>{msg.replyTo.senderId === userId ? "You" : "Them"}:</span>
                        <p>{msg.replyTo.content?.slice(0, 100) || "This message was deleted"}</p>
                      </div>
                    )}

                    {/* Content */}
                    {mediaType === "image" ? (
                      <Image
                        src={msg.content}
                        alt="Media"
                        style={{
                          maxWidth: "100%",
                          borderRadius: "12px",
                          maxHeight: "200px",
                        }}
                      />
                    ) : mediaType === "video" ? (
                      <video
                        src={msg.content}
                        controls
                        style={{
                          maxWidth: "100%",
                          borderRadius: "12px",
                          maxHeight: "200px",
                        }}
                      />
                    ) : (
                      msg.content
                    )}

                    {/* Always visible tick icon (right-aligned) */}
                    {seenMessages.has(msg.id) && isFromCurrentUser && (
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "rgb(240, 212, 157)",
                          position: "absolute",
                          right: "-9px",
                          bottom: "0px",
                          fontWeight: "900",
                        }}
                      >
                        <IoCheckmarkSharp />
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#888",
                      cursor: "pointer",
                    }}
                    onClick={() => setReplyToId(msg.id)}
                  >
                    {isFromCurrentUser ? (
                      <PiArrowBendUpLeftBold />
                    ) : (
                      <PiArrowBendDownRightBold />
                    )}
                  </div>

                  {/* Hover-only "seen at" text (left-aligned outside bubble) */}
                  {seenMessages.has(msg.id) && isFromCurrentUser && (
                    <div
                      style={{
                        position: "absolute",
                        left: "-100px",
                        top: "55%",
                        transform: "translateY(-50%)",
                        fontSize: "0.75rem",
                        color: "#999",
                        opacity: hovered ? 1 : 0,
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
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* actions box  */}
      <div
        style={{
          padding: "0.75rem",
          borderTop: `1px solid ${isDark ? "rgb(91, 87, 87)" : "#e1e1e1"}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* media preview */}
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
                    }}
                  />
                ) : (
                  <video
                    src={file.url}
                    controls
                    style={{
                      borderRadius: "6px",
                      maxWidth: "100%",
                      maxHeight: "100px",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {/* reply preview */}
        {replyToId && (
          <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" , justifyContent: "space-between"}}>
            <span>Replying to: {findMessageById(replyToId)?.content.slice(0, 30)}</span>
            <button onClick={() => setReplyToId(null)}>✖</button>
          </div>
        )}

        {/* input options  */}
        <Flex align="center" gap="1rem" style={{ width: "100%" }}>
          <MediaUploadButton
            onUpload={(urls) => {
              const newMedia = urls.map((url) => ({
                url,
                type: getMediaType(url),
              }));
              setPendingMedia((prev) => [...prev, ...newMedia]);
            }}
          />

          {/* === Emoji Picker Button === */}
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
                style={{ position: "absolute", bottom: "50px", zIndex: 100 }}
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

          {/* text input */}
          <Input.TextArea
            variant="borderless"
            autoSize={{ minRows: 1, maxRows: 4 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
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
            disabled={!text.trim() && pendingMedia.length === 0}
            icon={<Icon icon="ic:round-send" />}
          />
        </Flex>
      </div>
    </div>
  );
}
