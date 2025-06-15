"use client";

import { useEffect, useState, useRef, useContext } from "react";
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

export default function ChatPage() {
  const { followerId } = useParams();
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);
  const { getToken, userId } = useAuth();
  const [receiver, setReceiver] = useState({});
  const [pendingMedia, setPendingMedia] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiOpenRef = useRef(null);
  const [mediaPreviews, setMediaPreviews] = useState([]); // array of { loading: true } or { url, type }


  // useState for emoji picker hiding when outside click
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



  const {
    settings,
    pusherClient,
    setPusherClient,
    setOnlineUsers,
    onlineUsers,
    updateLastMessage,
  } = useContext(SettingsContext);
  const isDark = settings.theme === "dark";

  useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
}, [messages]);

  const getMediaType = (url) => {
    if (/\.(jpeg|jpg|png|gif|webp)$/i.test(url)) return "image";
    if (/\.(mp4|webm|mov)$/i.test(url)) return "video";
    return "text";
  };

  const loadMessages = async () => {
  if (!followerId) return;

  try {
    const res = await fetch(`/api/messages/${followerId}`, {
      credentials: "include", // 🔐 Important for sending Clerk cookies
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch messages: ${res.status}`);
    }

    const data = await res.json();
    setChatId(data.chat?.id || null);

    const parsedMessages = (data.messages || []).map((msg) => {
      const mediaType = getMediaType(msg.content);
      return {
        ...msg,
        type: mediaType === "text" ? msg.type || "text" : "media",
        mediaFormat: mediaType !== "text" ? mediaType : undefined,
      };
    });

    setMessages(parsedMessages);

    updateLastMessage(
      data.chat?.id,
      data.messages?.[data.messages.length - 1]
    );
  } catch (error) {
    console.error("Failed to load messages:", error);
  }
};


  const getReceiver = async () => {
    if (!followerId) return;
    const user = await getUser(followerId);
    if (user) setReceiver(user);
  };

  useEffect(() => {
    loadMessages();
    getReceiver();
  }, [followerId]);

  useEffect(() => {
    if (!chatId || !pusherClient) return;
    const channelName = `private-chat-${chatId}`;
    const channel = pusherClient.subscribe(channelName);
    console.log("subscribed to channel:", channelName);
    channel.bind("pusher:subscription_error", (err) => {
        console.error("Subscription error:", err);
      });


    channel.bind("new-message", (data) => {
      let incomingMessage = data.message;
      const mediaType = getMediaType(incomingMessage.content);
      if (!incomingMessage.type || incomingMessage.type === "text") {
        incomingMessage = {
          ...incomingMessage,
          type: mediaType !== "text" ? "media" : "text",
          mediaFormat: mediaType !== "text" ? mediaType : undefined,
        };
      }

      setMessages((prev) => {
        const index = prev.findIndex(
          (m) => m.id === incomingMessage.id
        );//fix vercel not working on pending messages

        let updated = [...prev];
        if (index !== -1) {
          updated[index] = {
            ...incomingMessage,
            status: "sent", // mark it sent
          };
        } else {
          updated.push({ ...incomingMessage, status: "sent" });
        }


        if (updated.length <= 10)
          return updated.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );

        const splitIndex = updated.length - 10;
        const first = updated.slice(0, splitIndex);
        const lastTen = updated
          .slice(splitIndex)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        return [...first, ...lastTen];
      });
    });

    channel.bind("pusher:subscription_error", async () => {
      await initializePusher({ setPusherClient, setOnlineUsers });
    });

    return () => {
      channel.unbind("new-message");
      pusherClient.unsubscribe(channelName);
    };
  }, [chatId, pusherClient]);

  const sendMessage = async () => {
  if (!chatId) return;

  // 2. No longer need to fetch the token!
  // const token = await getToken({ skipCache: true });

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
        id: msgMediaId, chatId, senderId: userId, content: media.url,
        type: "media", status: "pending", createdAt: new Date().toISOString(),
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
          body: JSON.stringify({ content: media.url, type: "media" , id: msgMediaId }),
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
      id: msgId, chatId, senderId: userId, content: trimmedText,
      type: "text", status: "pending", createdAt: new Date().toISOString(),
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
        body: JSON.stringify({ content: trimmedText, type: "text", id: msgId }),
      })
    );
  }

  try {
    await Promise.all(sendPromises);
  } catch (err) {
    console.error("One or more messages failed to send:", err);
  }
};




  silentRefresh(() => {
    loadMessages();
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

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {messages.map((msg) => {
          const isFromCurrentUser = msg.senderId === userId;
          const mediaType = msg.mediaFormat || getMediaType(msg.content);

          return (
            <div
              key={msg.id}
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
              {!isFromCurrentUser && (
                <Avatar src={receiver?.data?.image_url} size={30} />
              )}
              <div
                style={{
                  maxWidth: "50%",
                  padding: "0.75rem 1rem",
                  borderRadius: "1.5rem",
                  backgroundColor: isDark ? "#1a1a1a" : "#f2f2f2",
                  fontSize: "0.95rem",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                  color: isDark ? "#f2f2f2" : "#1a1a1a",
                }}
              >
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
                    autoPlay={false}
                    style={{
                      maxWidth: "100%",
                      borderRadius: "12px",
                      maxHeight: "200px",
                    }}
                  />
                ) : (
                  msg.content
                )}
              </div>
            </div>
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
          <div style={{ position: "relative" }} 
            ref={emojiOpenRef}>
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
