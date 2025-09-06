export const fetchMessages = async ({ pageParam = null, queryKey }) => {
  const [_key, followerId] = queryKey;
  const url = new URL(`/api/messages/${followerId}`, window.location.origin);
  url.searchParams.set("limit", "20");
  if (pageParam) {
    url.searchParams.set("before", pageParam);
  }

  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch messages. Status: ${res.status}. Response: ${text}`);
  }
  
  const data = await res.json();
  
  // Transform the messages to include media type info
  const getMediaType = (url) => {
    if (/\.(jpeg|jpg|png|gif|webp)$/i.test(url)) return "image";
    if (/\.(mp4|webm|mov)$/i.test(url)) return "video";
    return "text";
  };

  const transformedMessages = data.messages.map((msg) => {
    const mediaType = getMediaType(msg.content);
    return {
      ...msg,
      type: mediaType === "text" ? msg.type || "text" : "media",
      mediaFormat: mediaType !== "text" ? mediaType : undefined,
      toBeSeen: !msg.seen,
    };
  });

  return {
    ...data,
    messages: transformedMessages,
    // For infinite query pagination
    prevCursor: transformedMessages.length > 0 ? transformedMessages[0].id : null,
    hasMore: transformedMessages.length === 20,
  };
};