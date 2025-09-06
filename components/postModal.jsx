"use client";

import { useContext, useEffect } from "react";
import { SettingsContext } from "@/context/settings/settings-context";
import { useQuery } from "@tanstack/react-query";
import Post from "./Post";
import PostSkeleton from "./PostSkeleton";

export default function PostModal() {
  const { postModalId, closePostModal, settings } = useContext(SettingsContext);
  const theme = settings?.theme || "dark";

  useEffect(() => {
    if (postModalId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [postModalId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["post", postModalId],
    queryFn: async () => {
      console.log("Fetching post with ID:", postModalId);

      const response = await fetch(`/api/post/${postModalId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch post: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Fetched post data:", data);
      return data;
    },
    enabled: !!postModalId,
    retry: 2,
    cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
    // staleTime: 1 * 60 * 1000, // Data is fresh for 1 minute
  });

  if (!postModalId) return null;

  const bgColor = theme === "dark" ? "#1a1a1a" : "rgb(246 246 246)";
  const borderColor = theme === "dark" ? "#333" : "#ccc";
  const textColor = theme === "dark" ? "#eee" : "#111";

  return (
    <div
      onClick={closePostModal}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 99999,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: bgColor,
          color: textColor,
          borderRadius: "10px",
          overflowY: "auto",
          maxHeight: "90vh",
          width: isLoading ? "300px" : "min(700px, 95%)",
          padding: isLoading ? "1rem 0.5rem" : "1rem",
          border: `1px solid ${borderColor}`,
          boxShadow: "0 0 10px rgba(0,0,0,0.3)",
          transition: "all 0.3s ease",
        }}
      >
        {isLoading ? (
          <PostSkeleton compact={true} />
        ) : error ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>Error loading post: {error.message}</p>
            <button 
              onClick={() => window.location.reload()} 
              style={{ 
                marginTop: "1rem", 
                padding: "0.5rem 1rem", 
                background: "#007bff", 
                color: "white", 
                border: "none", 
                borderRadius: "4px", 
                cursor: "pointer" 
              }}
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <Post data={data} queryId={["post", postModalId]} />
        ) : (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>Post not found</p>
          </div>
        )}
      </div>
    </div>
  );
}
