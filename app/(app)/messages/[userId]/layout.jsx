// app/messages/[userId]/layout.jsx
"use client";

import { useState, useEffect } from "react";
import { getAllFollowersAndFollowingInfo } from "@/actions/user";
import Link from "next/link";
import { useParams } from "next/navigation";
import css from "@/styles/messages.module.css";
import Avatar from "antd/es/avatar/avatar";

const Layout = ({ children }) => {
  // Get params using the new hook
  const params = useParams();
  const userId = params.userId;
  
  const [followers, setFollowers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
//   console.log(followers)

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

  return (
    <div className={css.container}>
      {/* Left sidebar */}
      <div className={css.leftcontainer}>
        {isLoading ? (
          <p>Loading...</p>
        ) : followers?.length > 0 ? (
          <div className={css.followerList}>
            {followers.map((follower) => (
              <div key={follower.id} className={css.followerItem}>
                <Link href={`/messages/${userId}/${follower.follower.id}`}>
                  <div className={css.followerAvatar}>
                    <Avatar
                      size={40}
                      src={follower.follower.image_url}
                      alt={follower.follower.username}
                    />
                  </div>
                  <div className={css.followerInfo}>
                    <h3>
                      {follower.follower.username}
                    </h3>
                    <p className={css.lastMessage}>Last message preview...</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p>No followers found.</p>
        )}
      </div>

      {/* Right container */}
      <div className={css.rightcontainer}>
        {children}
      </div>
    </div>
  );
};

export default Layout;