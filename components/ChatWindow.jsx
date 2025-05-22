"use client";
import { useState, useEffect, useRef } from "react";

export function ChatWindow({ currentUserId, recipientId, ably }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  // Generate deterministic channel name for 1:1 chat
  const getChannelName = () => {
    const ids = [currentUserId, recipientId].sort();
    return `chat-${ids.join('-')}`;
  };

  useEffect(() => {
    const channel = ably.channels.get(getChannelName());

    // Subscribe to new messages
    channel.subscribe('message', (msg) => {
      setMessages(prev => [...prev, msg.data]);
    });

    // Fetch initial messages (you'd replace this with your Supabase fetch)
    const loadInitialMessages = async () => {
      const res = await fetch(`/api/messages?user1=${currentUserId}&user2=${recipientId}`);
      const data = await res.json();
      setMessages(data);
    };
    loadInitialMessages();

    return () => channel.unsubscribe();
  }, [currentUserId, recipientId, ably]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    
    const channel = ably.channels.get(getChannelName());
    channel.publish('message', {
      sender: currentUserId,
      content: newMessage,
      timestamp: Date.now()
    });

    setNewMessage("");
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`message ${msg.sender === currentUserId ? 'sent' : 'received'}`}
          >
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="message-input">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}