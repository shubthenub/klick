"use client";

import { useState, useEffect, useContext } from "react";
import { getAllFollowersAndFollowingInfo } from "@/actions/user";
import Link from "next/link";
import { useParams } from "next/navigation";
import Avatar from "antd/es/avatar/avatar";
import { SettingsContext } from "@/context/settings/settings-context";
import css from "@/styles/messages.module.css";

const Layout = ({ children }) => {
  const { settings } = useContext(SettingsContext);
  const isDark = settings.theme === "dark";

  const params = useParams();
  const userId = params.userId;

  const [followers, setFollowers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFollower, setActiveFollower] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { followers } = await getAllFollowersAndFollowingInfo(userId);
        setFollowers(followers);
      } catch (error) {
        console.error("Error fetching followers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId]);

  const activateFollower = (followerId) => {
    setActiveFollower(followerId);
  };

  return (
    <div
      className={css.container}
      style={{
        backgroundColor: isDark ? "#1a1a1a" : "#fff",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Left Sidebar */}
      <div
        className={css.leftcontainer}
        style={{
          borderRight: `1px solid ${isDark ? "#333" : "#e1e1e1"}`,
          background: isDark ? "#121212" : "#ffffff",
        }}
      >
        {isLoading ? (
          <p>Loading...</p>
        ) : followers?.length > 0 ? (
          <div className={css.followerList}>
            {followers.map((follower) => {
              const followerId = follower.follower.id;
              const isActive = followerId === activeFollower;

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
                        ? "#333"
                        : "#e0e0e0"
                      : "transparent",
                  }}
                >
                  <div className={css.followerAvatar}>
                    <Avatar
                      size={40}
                      src={follower.follower.image_url}
                      alt={follower.follower.username}
                    />
                  </div>
                  <div className={css.followerInfo}>
                    <h3>{follower.follower.username}</h3>
                    <p
                      className={css.lastMessage}
                      style={{ color: isDark ? "#aaa" : "#6c757d" }}
                    >
                      Last message preview...
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p>No followers found.</p>
        )}
      </div>

      {/* Right Chat Container */}
      <div
        className={css.rightcontainer}
        style={{
          backgroundColor: isDark ? "#121212" : "#ffffff",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Layout;
