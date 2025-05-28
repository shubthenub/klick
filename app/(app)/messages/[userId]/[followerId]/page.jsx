'use client';

import { useEffect, useState, useRef, useContext } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@clerk/nextjs';
import Pusher from 'pusher-js';
import css from '@/styles/chatpage.module.css'; // Assuming you have a CSS module for styles
import ChatInput from '@/components/ChatInput';
import { Button, Flex, Input } from 'antd';
import { Icon } from '@iconify/react';
import Avatar from 'antd/es/avatar/avatar';
import { getUser } from '@/actions/user';
import { SettingsContext } from '@/context/settings/settings-context';


export default function ChatPage() {
  const { followerId } = useParams();
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);
  const { getToken, userId } = useAuth();
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const [receiver, setReceiver] = useState({});
  const {settings} = useContext(SettingsContext); 
  const isDark = settings.theme === 'dark';

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

  // Fetch receiver details
  const getReceiver = async () => {
  if (!followerId) return;
  const user = await getUser(followerId);
  if (user) {
    setReceiver(user);
    console.log('Fetched Receiver:', user);  // ✅ Log the fetched value directly
  } else {
    console.error('Receiver not found for followerId:', followerId);
  }
};


  // Initial message load
  useEffect(() => {
    loadMessages();
    getReceiver();
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
    <div className={css.container} style={{
    height: '80vh',
    display: 'flex',
    flexDirection: 'column',
    // border: '1px solid gray',
  }}>

  {/* Scrollable Messages */}
  <div
    style={{
      flex: 1,
      overflowY: 'auto',
      padding: '1rem',
    }}
  >
    {messages.map((msg) => (
      <div key={msg.id} 
      style={{ 
        marginBottom: '0.5rem' ,
        display: 'flex',
        gap: '0.5rem',
        flexDirection: msg.senderId === userId ? 'row-reverse' : 'row',
        alignItems: 'center',
      }} >
        {msg.senderId !== userId && (
          <Avatar src={receiver?.data?.image_url} size={30} />
        )
        }
        
        <p className={css.message}>
          {msg.content}
        </p>
        
      </div>
    ))}
    <div ref={messagesEndRef} />
  </div>

  {/* Input box fixed at the bottom */}
  <div style={{
    padding: '0.75rem',
    borderTop: `1px solid ${isDark?'rgb(91, 87, 87)':'#e1e1e1'}`,
  }}>
    <Flex gap="1rem" align='center'>
      <Input.TextArea
        placeholder="Message..."
        autoSize={{ minRows: 1, maxRows: 5 }}
        value={text}
        variant='borderless'
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }}
        style={{
          resize: 'none',
          flex: 1,
        }}
      />
      <Button type="primary" onClick={sendMessage}>
        <Icon icon="iconamoon:send-fill" width="1rem" />
      </Button>
    </Flex>
  </div>
</div>

  );
}