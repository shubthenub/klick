"use client";

import { useEffect, useRef, useCallback, useContext, useState } from "react";
import { SettingsContext } from "@/context/settings/settings-context";

export default function SeenWrapper({ 
  id, 
  type, 
  children, 
  isFromCurrentUser, 
  chatId, 
  seenMessages,
  status,
  disabled=true ,
}) {
  const ref = useRef(null);
  const observerRef = useRef(null);
  const { markSeen } = useContext(SettingsContext);

  const [isSending, setIsSending] = useState(false);
  const [hasMarked, setHasMarked] = useState(false); // ✅ prevent repeat
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRIES = 3;

  const isAlreadySeen = hasMarked || seenMessages?.has?.(id);

  const sendSeenRequest = useCallback(async () => {
    if (disabled || isAlreadySeen || isSending || retryCount >= MAX_RETRIES) return;

    setIsSending(true);
    console.log("📬 Attempting to mark seen:", id, `(Try ${retryCount + 1})`);

    try {
      const res = await fetch("/api/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type, chatId }),
      });

      if (res.ok) {
        markSeen(id);
        setHasMarked(true); // ✅ Mark local success
        console.log("✅ Successfully marked seen:", id);
      } else {
        throw new Error("Failed to mark as seen");
      }
    } catch (error) {
      console.error("❌ Seen error:", error.message);
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => setRetryCount((prev) => prev + 1), 1000);
      }
    } finally {
      setIsSending(false);
    }
  }, [
    id,
    type,
    chatId,
    disabled,
    isAlreadySeen,
    isSending,
    retryCount,
    markSeen,
  ]);

  const handleIntersection = useCallback(([entry], observerInstance) => {
    if (!entry.isIntersecting || isAlreadySeen) return;

    observerInstance.unobserve(entry.target);
    sendSeenRequest();
  }, [isAlreadySeen, sendSeenRequest]);

  useEffect(() => {
    if (
      !chatId ||
      isFromCurrentUser ||
      status === "pending" ||
      !ref.current ||
      isAlreadySeen
    ) {
      return;
    }

    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.8,
      rootMargin: "0px 0px -50px 0px",
    });

    observerRef.current = observer;
    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [chatId, isFromCurrentUser, status, isAlreadySeen, handleIntersection]);

  return <div ref={ref}>{children}</div>;
}
