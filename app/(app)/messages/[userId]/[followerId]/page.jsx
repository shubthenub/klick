"use client";

import { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@clerk/nextjs";
import Pusher from "pusher-js";
import css from "@/styles/chatpage.module.css"; // Assuming you have a CSS module for styles
import ChatInput from "@/components/ChatInput";
import { Button, Flex, Input } from "antd";
import { Icon } from "@iconify/react";
import Avatar from "antd/es/avatar/avatar";
import { getUser } from "@/actions/user";
import { SettingsContext } from "@/context/settings/settings-context";

export default function ChatPage() {
  const { followerId } = useParams();
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);
  const { getToken, userId } = useAuth();
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const [receiver, setReceiver] = useState({});
  const { settings } = useContext(SettingsContext);
  const isDark = settings.theme === "dark";

  // Scroll to bottom when messages update
  useEffect(() => {
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 0);
    return () => clearTimeout(timeout);
  }, [messages]);

  // Load messages from API
  const loadMessages = async () => {
    if (!followerId) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/messages/${followerId}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setChatId(data.chat?.id || null);
      setMessages(data.messages || []);
      console.log(
        "[loadMessages] Loaded messages:",
        data.messages?.length || 0
      );
    } catch (error) {
      console.error("[loadMessages] Failed to load messages:", error);
    }
  };

  // Fetch receiver details
  const getReceiver = async () => {
    if (!followerId) return;
    const user = await getUser(followerId);
    if (user) {
      setReceiver(user);
      console.log("Fetched Receiver:", user);
    } else {
      console.error("Receiver not found for followerId:", followerId);
    }
  };

  // Initial message load
  useEffect(() => {
    loadMessages();
    getReceiver();
  }, [followerId]);

  // Setup Pusher connection and channel subscription
  useEffect(() => {
    if (!chatId || !userId) return;

    const initializePusher = async () => {
      try {
        const token = await getToken();

        pusherRef.current = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
          authEndpoint: "/api/pusher/auth",
          auth: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          forceTLS: true,
        });

        const channelName = `private-chat-${chatId}`;
        channelRef.current = pusherRef.current.subscribe(channelName);

        channelRef.current.bind("new-message", (data) => {
  console.log("New message received via Pusher:", data);
  const incomingMessage = data.message;

  setMessages(prevMessages => {
    const index = prevMessages.findIndex(
      (m) =>
        m.status === "pending" &&
        m.content === incomingMessage.content &&
        m.senderId === incomingMessage.senderId &&
        Math.abs(new Date(m.createdAt) - new Date(incomingMessage.createdAt)) < 5000 // close enough
    );

    let updatedMessages;
    if (index !== -1) {
      // Replace pending message with actual one
      updatedMessages = [...prevMessages];
      updatedMessages[index] = incomingMessage;
    } else {
      // Append new message
      updatedMessages = [...prevMessages, incomingMessage];
    }

    // Sort only the last 10 messages by createdAt
    if (updatedMessages.length <= 10) {
      return updatedMessages.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    }

    const splitIndex = updatedMessages.length - 10;
    const firstPart = updatedMessages.slice(0, splitIndex);
    const lastTen = updatedMessages.slice(splitIndex);

    lastTen.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return [...firstPart, ...lastTen];
  });
});


        channelRef.current.bind("pusher:subscription_error", (status) => {
          console.error("Pusher subscription error:", status);
        });

        channelRef.current.bind("pusher:subscription_succeeded", () => {
          console.log("Successfully subscribed to channel:", channelName);
        });
      } catch (error) {
        console.error("Pusher initialization error:", error);
      }
    };

    initializePusher();

    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all();
        channelRef.current.unsubscribe();
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, [chatId, userId, getToken]);

  // Send message
  const sendMessage = async () => {
    if (!text.trim() || !chatId) return;

    // When sending:
    const tempId = `temp-${Date.now()}`;
    const newMessage = {
      id: tempId,
      chatId,
      senderId: userId,
      content: text,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);

    const currentText = text;
    setText("");

    try {
      const token = await getToken();
      await fetch(`/api/messages/${followerId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: currentText }),
      });

      console.log("[sendMessage] Message sent successfully");
    } catch (error) {
      console.error("[sendMessage] Failed to send message:", error);
      // Optionally, you can update this message's status to failed here
    }
  };

  return (
    <div
      className={css.container}
      style={{
        height: "86vh",
        display: "flex",
        flexDirection: "column",
      }}
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
          <Avatar src={receiver?.data?.image_url} size={40} />
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

      {/* Scrollable Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
        }}
      >
        {messages.map((msg) => {
          const isFromCurrentUser = msg.senderId === userId;

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
              <p
                className={css.message}
                style={{
                  maxWidth: "50%",
                  padding: "0.75rem 1rem",
                  borderRadius: "1.5rem",
                  backgroundColor: isDark ? "#1a1a1a" : "#f2f2f2",
                  fontSize: "0.95rem",
                  lineHeight: "1.4",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                  color: isDark ? "#f2f2f2" : "#1a1a1a",
                }}
              >
                {msg.content}
              </p>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input box fixed at the bottom */}
      <div
        style={{
          padding: "0.75rem",
          borderTop: `1px solid ${isDark ? "rgb(91, 87, 87)" : "#e1e1e1"}`,
        }}
      >
        <Flex align="center" gap="1rem">
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
            style={{
              resize: "none",
              height: "1rem",
              flex: 1,
              // borderRadius: 8,
              // borderColor: isDark ? "#555" : "#ccc",
              // backgroundColor: isDark ? "#2a2a2a" : "#fff",
              // color: isDark ? "#fff" : "#000",
            }}
          />
          <Button
            type="primary"
            onClick={sendMessage}
            disabled={!text.trim()}
            icon={<Icon icon="ic:round-send" />}
          />
        </Flex>
      </div>
    </div>
  );
}
