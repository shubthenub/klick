# 🧵 Nested Replies with Optimistic Updates in React + React Query

This guide explains how to implement **nested comment replies** in a React application using **React Query** with **optimistic updates**, complete with example code and beginner-friendly explanations.

---

## 🧠 What Are Nested Replies?

Nested replies allow users to reply to comments, and those replies can be replied to as well, forming a tree structure like:

```text
Comment A
  └─ Reply A1
        └─ Reply A1a
  └─ Reply A2
Comment B
```

---

## 🚀 Technologies Used

* **React** (for UI)
* **React Query** (for data fetching + cache)
* **Clerk** (for user authentication)
* **Ant Design** (UI components)
* **Prisma** (ORM for DB — in backend)

---

## 📦 Backend Schema (Prisma)

```prisma
model Comment {
  id        Int       @id @default(autoincrement())
  comment   String
  postId    Int
  authorId  String
  createdAt DateTime  @default(now())

  post    Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  author  User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  parentId Int?
  parent   Comment?   @relation("ReplyThread", fields: [parentId], references: [id])
  replies  Comment[]  @relation("ReplyThread")
}
```

* `parentId` is `null` for top-level comments.
* Replies reference their parent comment using `parentId`.

---

## 🧾 React Query Optimistic Updates

### 🔹 Step 1: Comment Input Component

```js
const { mutate } = useMutation({
  mutationFn: (commentText) => addComment(postId, commentText, user.id, parentId),

  onMutate: async (commentText) => {
    await queryClient.cancelQueries(["posts", queryId]);
    const previousPosts = queryClient.getQueryData(["posts", queryId]);

    const newComment = {
      id: `temp-${Date.now()}`,
      comment: commentText,
      author: {
        first_name: user.firstName,
        last_name: user.lastName,
        username: user.username,
        image_url: user.imageUrl,
      },
      parentId,
      replies: [],
      createdAt: new Date().toISOString(),
    };

    queryClient.setQueryData(["posts", queryId], (old) => {
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: page.data.map((post) => {
            if (post.id !== postId) return post;
            const updatedComments = parentId
              ? insertNestedComment(post.comments, parentId, newComment)
              : [newComment, ...post.comments];
            return { ...post, comments: updatedComments };
          }),
        })),
      };
    });

    return { previousPosts };
  },

  onError: (err, _, context) => {
    queryClient.setQueryData(["posts", queryId], context.previousPosts);
  },

  onSettled: () => {
    queryClient.invalidateQueries(["posts", queryId]);
  }
});
```

### 🔹 `insertNestedComment()` Utility

This recursive function finds the parent comment and inserts the reply.

```js
const insertNestedComment = (comments, parentId, newComment) => {
  return comments.map((comment) => {
    if (comment.id === parentId) {
      return {
        ...comment,
        replies: [...(comment.replies || []), newComment],
      };
    }
    if (comment.replies?.length) {
      return {
        ...comment,
        replies: insertNestedComment(comment.replies, parentId, newComment),
      };
    }
    return comment;
  });
};
```

---

## 🌳 Building a Nested Tree From Flat Data

### 🔹 In `CommentsSection.jsx`

```js
const groupedReplies = groupBy(comments.filter(c => c.parentId), 'parentId');

const enhanceCommentTree = (comment) => ({
  ...comment,
  replies: (groupedReplies[comment.id] || [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // latest first
    .map(enhanceCommentTree),
});

const enhancedComments = topLevelComments.map(enhanceCommentTree);
```

---

## 💬 Comment Component (Recursive UI)

### 🔹 `Comment.jsx`

```js
return (
  <div>
    <Flex>
      <Avatar src={data.author.image_url} />
      <Flex vertical>
        <Typography.Text>
          {data.parent?.author?.username && (
            <strong>@{data.parent.author.username} </strong>
          )}
          {data.comment}
        </Typography.Text>
      </Flex>
    </Flex>

    {isReplying && (
      <CommentInput
        postId={postId}
        queryId={queryId}
        parentId={data.id}
        parentAuthor={data.author.username}
        onCancelReply={() => setReplyingTo(null)}
      />
    )}

    {showReplies && (
      <div style={{ marginLeft: depth === 0 ? '2.5rem' : '0' }}>
        {data.replies.map((reply) => (
          <Comment
            key={reply.id}
            data={reply}
            depth={depth + 1}
            postId={postId}
            queryId={queryId}
            setReplyingTo={setReplyingTo}
            replyingTo={replyingTo}
          />
        ))}
      </div>
    )}
  </div>
);
```

---

## ✅ What Beginners Should Remember

* **Optimistic updates** make the UI feel instant by updating cache before the server responds.
* Always revert cache in `onError` to prevent stale UI.
* Group flat comments by `parentId` to create a **nested reply structure**.
* Use recursion in UI and logic to handle **infinite depth of replies**.
* Always sort replies as needed (e.g. newest first).

---

## 🎉 Outcome

* Smooth, real-time-like comment experience
* Nested replies with `@username`
* Maintains structure and performance

---

## 📌 Bonus Ideas

* Add emoji reactions to each comment
* Support markdown in comments
* Show "typing" indicators using WebSocket/Pusher

---

Feel free to modify this for your own project needs!
