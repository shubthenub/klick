"use client";
import { useEffect, useState } from "react";

export function FollowerRow({ follower, ably, currentUserId }) {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const channel = ably.channels.get(`presence-${follower.id}`);
    
    channel.presence.subscribe('enter', () => setIsOnline(true));
    channel.presence.subscribe('leave', () => setIsOnline(false));

    // Check current presence
    channel.presence.get().then((members) => {
      setIsOnline(members.some(m => m.clientId === follower.id));
    });

    return () => channel.presence.unsubscribe();
  }, [follower.id, ably]);

  return (
    <>
      <span>{follower.name}</span>
      <span style={{ color: isOnline ? 'green' : 'gray' }}>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </>
  );
}