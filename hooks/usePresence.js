// hooks/usePresence.ts
import { useEffect, useState } from "react";
import { pusherClient } from "@/lib/pusher"; // adjust the path if needed

export default function usePresence(userId) {
    const [onlineUserIds, setOnlineUserIds] = useState([]);

    useEffect(() => {
        if (!userId) return;

        const channel = pusherClient.subscribe("presence-global");

        const updateOnlineUsers = (members) => {
            const ids = members.map((member) => member.id);
            setOnlineUserIds(ids);
        };

        channel.bind("pusher:subscription_succeeded", (members) => {
            updateOnlineUsers(members);
        });

        channel.bind("pusher:member_added", (member) => {
            setOnlineUserIds(prev => [...prev, member.id]);
        });

        channel.bind("pusher:member_removed", (member) => {
            setOnlineUserIds(prev => prev.filter(id => id !== member.id));
        });

        return () => {
            pusherClient.unsubscribe("presence-global");
        };
    }, [userId]);

    return onlineUserIds;
}
