# React Query Conversion Documentation

This document details all the changes made to convert the chat page from traditional API calls to React Query-based implementation.

## 🎯 **Objective**
Convert the chat page's `loadMessages` function and message handling to use React Query for better:
- Caching
- Infinite scrolling
- Optimistic updates
- Real-time updates

---

## 📁 **Files Created/Modified**

### 1. **NEW FILE: `hooks/useMessages.js`**
Created custom React Query hooks for all message-related operations.

#### **useMessages Hook**
```javascript
export const useMessages = (followerId) => {
  return useInfiniteQuery({
    queryKey: ['messages', followerId],
    queryFn: async ({ pageParam = null }) => {
      // Fetch messages with pagination
      const url = new URL(`/api/messages/${followerId}`, window.location.origin);
      url.searchParams.set('limit', '20');
      
      if (pageParam) {
        url.searchParams.set('before', pageParam);
      }
      // ... fetch logic
    },
    getNextPageParam: (lastPage) => {
      // Return oldest message ID for pagination
      return lastPage.messages?.[0]?.id;
    },
    // ... other config
  });
};
```

#### **useSendMessage Hook**
```javascript
export const useSendMessage = () => {
  return useMutation({
    mutationFn: async ({ followerId, messageData }) => {
      // Send message to API
    },
    onSuccess: () => {
      // Removed query invalidation to prevent duplicates
    }
  });
};
```

#### **useOptimisticMessage Hook**
```javascript
export const useOptimisticMessage = (followerId) => {
  const addOptimisticMessage = (message) => {
    // Add message to React Query cache immediately
    queryClient.setQueryData(['messages', followerId], (old) => {
      // Add to first page (newest messages)
    });
  };

  const updateMessageStatus = (messageId, status) => {
    // Update specific message status in cache
  };
};
```

---

## 🔄 **Major Changes Made**

### 2. **MODIFIED: `app/(app)/messages/[userId]/[followerId]/page.jsx`**

#### **A. Removed Old Loading Logic**
```javascript
// ❌ REMOVED: Old loadMessages function
const loadMessages = async (isInitial = false) => {
  // ... 70+ lines of fetch logic, pagination, scrolling
};

// ❌ REMOVED: useEffect that called loadMessages
useEffect(() => {
  loadMessages(true);
  getReceiver();
}, [followerId]);
```

#### **B. Added React Query Integration**
```javascript
// ✅ ADDED: React Query hooks
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  error,
} = useMessages(followerId);

const sendMessageMutation = useSendMessage();
const { addOptimisticMessage, updateMessageStatus } = useOptimisticMessage(followerId);
```

#### **C. Fixed Message Ordering**
```javascript
// ✅ FIXED: Proper message ordering (older first, newer last)
const messages = useMemo(() => {
  if (!data?.pages) return [];
  // Reverse pages so older pages (fetched later) come first
  const reversedPages = [...data.pages].reverse();
  return reversedPages.flatMap(page => {
    // Process and return messages
  });
}, [data]);
```

#### **D. Implemented Infinite Scrolling**
```javascript
// ✅ ADDED: Infinite scroll on top scroll
const handleScroll = () => {
  const { scrollTop } = scrollContainerRef.current;
  
  // Load older messages when scrolled near top
  if (scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
    const prevScrollHeight = scrollContainerRef.current.scrollHeight;
    fetchNextPage().then(() => {
      // Maintain scroll position after loading
      requestAnimationFrame(() => {
        const newScrollHeight = scrollContainerRef.current.scrollHeight;
        const scrollDiff = newScrollHeight - prevScrollHeight;
        scrollContainerRef.current.scrollTop = scrollTop + scrollDiff;
      });
    });
  }
};
```

#### **E. Fixed Message Status and Opacity**
```javascript
// ✅ FIXED: Proper opacity logic
style={{
  opacity: msg.status === "pending" ? 0.6 : 1,
  transform: msg.status === "pending" ? "translateX(-5px)" : "none",
}}

// KEY INSIGHT: Only messages with status="pending" get reduced opacity
// Messages loaded from DB don't have status field, so they appear normal
```

#### **F. Implemented Optimistic Updates**
```javascript
// ✅ ADDED: Optimistic message sending
const sendMessage = async () => {
  // Create optimistic message
  const optimisticMessage = {
    id: msgId,
    chatId,
    senderId: userId,
    content: trimmedText,
    type: "text",
    status: "pending", // ← This causes 60% opacity
    createdAt: new Date().toISOString(),
  };

  // Add immediately to UI
  addOptimisticMessage(optimisticMessage);
  
  // Scroll immediately after adding
  setTimeout(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, 50);

  // Send to server (don't update status here)
  await sendMessageMutation.mutateAsync({ /* ... */ });
};
```

#### **G. Fixed Pusher Integration**
```javascript
// ✅ FIXED: Prevent duplicate messages from Pusher
const handleNewMessage = (incomingMessageRaw) => {
  if (incomingMessageRaw.senderId === userId) {
    // This is confirming our optimistic message
    updateMessageStatus(incomingMessageRaw.id, "sent");
  } else {
    // This is a new message from another user
    addOptimisticMessage(incomingMessage);
  }
};
```

#### **H. Fixed Scrolling Behavior**
```javascript
// ✅ FIXED: Smart scrolling logic
// 1. Scroll on initial load only
useEffect(() => {
  if (messages.length > 0 && !hasScrolledInitially.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    hasScrolledInitially.current = true;
  }
}, [messages.length]);

// 2. Scroll immediately when sending message (not on status change)
// Added to addOptimisticMessage calls in sendMessage function

// 3. No scrolling when loading older messages (maintains position)
```

---

## 🐛 **Issues Fixed**

### **Issue 1: Duplicate Messages**
**Problem**: Messages appeared twice when sent
**Root Cause**: Both mutation success callback AND Pusher were adding messages
**Solution**: 
- Removed `queryClient.invalidateQueries()` from mutation success
- Only Pusher updates status for confirmation
- Optimistic message gets status updated, not replaced

### **Issue 2: All Messages Had Reduced Opacity**
**Problem**: All messages showed 60% opacity instead of just pending ones
**Root Cause**: Logic was `msg.status === "sent" ? 1 : 0.6`
**Solution**: Changed to `msg.status === "pending" ? 0.6 : 1`
**Key Insight**: DB messages don't have status field, so they should appear normal

### **Issue 3: Wrong Message Order**
**Problem**: Older messages appeared below newer ones
**Root Cause**: Pages were being flattened in wrong order
**Solution**: Reverse pages array before flattening

### **Issue 4: Unwanted Scrolling**
**Problem**: Chat scrolled to bottom when loading older messages
**Root Cause**: Scroll effect triggered on all message changes
**Solution**: 
- Only scroll on initial load (`hasScrolledInitially` check)
- Only scroll immediately when sending message
- Maintain scroll position when loading older messages

### **Issue 5: Scroll Timing**
**Problem**: Scroll happened when status changed to "sent"
**Root Cause**: Scroll was in Pusher handler
**Solution**: Move scroll to happen immediately after adding optimistic message

---

## 🎯 **Key Learning Points**

### **1. React Query Infinite Queries**
- Use `useInfiniteQuery` for pagination
- `getNextPageParam` determines what to pass for next page
- `data.pages` is an array of page results
- Flatten pages properly for display

### **2. Optimistic Updates**
- Add message to cache immediately for instant feedback
- Use `queryClient.setQueryData()` to manipulate cache
- Don't invalidate queries on mutation success if using optimistic updates
- Let real-time updates (Pusher) confirm the changes

### **3. Message Status Management**
- `status: "pending"` → 60% opacity + slight shift
- `status: "sent"` → 100% opacity + normal position
- Messages from DB have no status → appear normal
- Only update status via Pusher to avoid duplicates

### **4. Scroll Management**
- Scroll immediately when user sends message
- Don't scroll on every message change
- Maintain scroll position when loading older content
- Use `block: "end"` for better scrolling behavior

### **5. Real-time Integration**
- Pusher should only update existing message status for sent messages
- Pusher should add new messages for messages from other users
- Check `senderId` to determine if it's confirmation or new message

---

## 📋 **Testing Checklist**

- [ ] Messages load correctly on initial page load
- [ ] Infinite scroll loads older messages at the top
- [ ] Sending message shows immediate feedback (60% opacity)
- [ ] Message becomes solid when confirmed via Pusher
- [ ] No duplicate messages appear
- [ ] Scroll position maintained when loading older messages
- [ ] Chat scrolls to bottom only when sending new message
- [ ] Messages from other users appear instantly
- [ ] Optimistic updates work for both text and media messages

---

## 🚀 **Performance Benefits**

1. **Caching**: Messages cached by React Query, reducing API calls
2. **Infinite Scroll**: Only load messages as needed
3. **Optimistic Updates**: Instant user feedback
4. **Smart Refetching**: React Query handles background updates
5. **Memory Efficient**: Old pages can be garbage collected
6. **Real-time**: Pusher integration for live updates

This conversion provides a much more responsive and efficient chat experience while maintaining all original functionality.
