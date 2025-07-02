"use client";
import { useState, useEffect, useContext } from "react";
import { getAllFollowersAndFollowingInfo } from "@/actions/user";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import Avatar from "antd/es/avatar/avatar";
import { SettingsContext } from "@/context/settings/settings-context";
import css from "@/styles/messages.module.css";
import { Input } from "antd";
import { useAuth } from "@clerk/nextjs";

const Layout = ({ children }) => {
  const { settings, onlineUsers, lastMessages } = useContext(SettingsContext);
  const isDark = settings.theme === "dark";
  const pathname = usePathname();
  const params = useParams();
  const { userId } = useAuth();

  const [followers, setFollowers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFollower, setActiveFollower] = useState(null);
  const [chatIdsByFollower, setChatIdsByFollower] = useState({});
  const [preparedLastMessages, setPreparedLastMessages] = useState([]);

  // Fetch followers
  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    getAllFollowersAndFollowingInfo(userId)
      .then((data) => {
        setFollowers(data.followers || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  }, [userId]);

  // Fetch chat IDs for each follower
  useEffect(() => {
    if (!userId || followers.length === 0) return;

    const fetchChatIds = async () => {
      const map = {};
      for (const follower of followers) {
        const fid = follower.follower.id;
        try {
          const res = await fetch("/api/findChatByParticipants", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participants: [userId, fid] }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.chatId) map[fid] = data.chatId;
          }
        } catch (err) {
          console.error("Failed fetching chatId for follower", fid, err);
        }
      }
      setChatIdsByFollower(map);
    };

    fetchChatIds();
  }, [followers, userId]);

  // Prepare last messages once chatIdsByFollower or lastMessages change
  useEffect(() => {
    if (followers.length === 0) return;

    // Build array of last messages corresponding to followers
    const arr = followers.map(({ follower }) => {
      const fid = follower.id;
      const chatId = chatIdsByFollower[fid];
      return chatId && lastMessages[chatId]?.content
        ? lastMessages[chatId].content
        : null;
    });

    setPreparedLastMessages(arr);
  }, [followers, chatIdsByFollower, lastMessages]);

  // Set active follower from URL
  useEffect(() => {
    const activeFollowerId = pathname?.split("/").pop();
    if (activeFollowerId) {
      setActiveFollower(activeFollowerId);
    }
  }, [pathname]);

  const activateFollower = (followerId) => {
    setActiveFollower(followerId);
  };

  // Only render followers when preparedLastMessages length matches followers length
  const canRenderFollowers =
    followers.length > 0 && preparedLastMessages.length === followers.length;

  return (
    <div
      className={css.container}
      style={{
        backgroundColor: isDark ? "rgb(0,0,0)" : "#fff",
        color: isDark ? "#fff" : "#000",
        overflow: "hidden",
      }}
    >
      <div
        className={css.leftcontainer}
        style={{
          borderRight: `1px solid ${isDark ? "#333" : "#e1e1e1"}`,
          backgroundColor: isDark ? "rgb(0,0,0)" : "#fff",
        }}
      >
        <div
          className={css.followerSearch}
          style={{
            backgroundColor: isDark ? "rgb(0,0,0)" : "#fff",
            padding: "10px",
          }}
        >
          <Input.Search placeholder="Search followers" />
        </div>

        {isLoading ? (
          <p>Loading followers...</p>
        ) : !canRenderFollowers ? (
          <p>Loading messages...</p>
        ) : (
          <div className={css.followerList}>
            {followers.map(({ follower }, index) => {
              const followerId = follower.id;
              const isActive = followerId === activeFollower;
              const lastMessage = preparedLastMessages[index] || "No messages yet";

              return (
                <Link
                  key={followerId}
                  href={`/messages/${userId}/${followerId}`}
                  onClick={() => activateFollower(followerId)}
                  className={`${css.followerItem} ${
                    isActive ? css.activeFollower : ""
                  }`}
                  style={{
                    backgroundColor: isActive
                      ? isDark
                        ? "rgb(29 29 29)"
                        : "#f1f1f1"
                      : "transparent",
                      overflow: "hidden",
                  }}
                >
                  <div
                    className={css.followerAvatar}
                    style={{ position: "relative" }}
                  >
                    <Avatar
                      size={40}
                      src={follower.image_url}
                      alt={follower.username}
                    />
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
                  <div className={css.followerInfo}>
                    <h3 style={{ color: isDark ? "white" : "black" }}>
                      {follower.username}
                    </h3>
                    <p
                      className={css.lastMessage}
                      style={{ color: isDark ? "#828282" : "#6c757d" , overflowY: "hidden",}}
                    >
                      {lastMessage}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div
        className={css.rightcontainer}
        style={{
          backgroundColor: isDark ? "rgb(0,0,0)" : "#fff",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Layout;
