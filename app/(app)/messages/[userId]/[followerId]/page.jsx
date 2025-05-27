'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@clerk/nextjs';
import Pusher from 'pusher-js';

export default function ChatPage() {
  const { followerId } = useParams();
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);
  const { getToken, userId } = useAuth();
  const pusherRef = useRef(null);
  const channelRef = useRef(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
    return () => clearTimeout(timeout);
  }, [messages]);

  // Load messages from API
  const loadMessages = async () => {
    if (!followerId) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/messages/${followerId}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setChatId(data.chat?.id || null);
      setMessages(data.messages || []);
      console.log('[loadMessages] Loaded messages:', data.messages?.length || 0);
    } catch (error) {
      console.error('[loadMessages] Failed to load messages:', error);
    }
  };

  // Initial message load
  useEffect(() => {
    loadMessages();
  }, [followerId]);

  // Setup Pusher connection and channel subscription
  // In your ChatPage component's Pusher setup:
useEffect(() => {
  if (!chatId || !userId) return;

  const initializePusher = async () => {
    try {
      const token = await getToken();
      
      pusherRef.current = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
        authEndpoint: '/api/pusher/auth',
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        forceTLS: true,
      });

      const channelName = `private-chat-${chatId}`;
      channelRef.current = pusherRef.current.subscribe(channelName);

      channelRef.current.bind('new-message', (data) => {
        console.log('New message received via Pusher:', data);
        setMessages(prev => [...prev, data.message]);
      });

      channelRef.current.bind('pusher:subscription_error', (status) => {
        console.error('Pusher subscription error:', status);
      });

      channelRef.current.bind('pusher:subscription_succeeded', () => {
        console.log('Successfully subscribed to channel:', channelName);
      });

    } catch (error) {
      console.error('Pusher initialization error:', error);
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
    try {
      const token = await getToken();
      console.log('[sendMessage] Sending message:', text);
      await fetch(`/api/messages/${followerId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: text }),
      });
      setText('');
      console.log('[sendMessage] Message sent successfully');
    } catch (error) {
      console.error('[sendMessage] Failed to send message:', error);
    }
  };

  return (
    <div
      style={{
        height: '80vh',
        overflowY: 'scroll',
        border: '1px solid gray',
        padding: '1rem',
      }}
    >
      <div>
        {messages.map((msg) => (
          <p key={msg.id} className="mb-1">
            <b>{msg?.senderId}</b>: {msg.content}
          </p>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        placeholder="Type a message"
        className="border border-gray-300 rounded px-2 py-1 w-full mt-2"
      />
    </div>
  );
}