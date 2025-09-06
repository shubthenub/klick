// app/api/post/[id]/route.js
import prisma from "@/lib/prisma.js";
import { redisGet, redisSet } from "@/lib/redisSet";

export async function GET(request, { params }) {
  try {
    const postId = Number(params.id);

    if (isNaN(postId)) {
      return Response.json({ error: "Invalid post ID" }, { status: 400 });
    }

    const redisKey = `post:${postId}`;
    const cachedPostString = await redisGet(redisKey);

    // If cache hit, parse the string to a JSON object
    if (cachedPostString) {
      const cachedPost = JSON.parse(cachedPostString);
      // The cached data should already contain the _count field
      return Response.json(cachedPost, { status: 200 });
    }

    // Cache miss, fetch from DB
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: true,
        likes: true,
        comments: {
          // This part fetches comments but doesn't include the nested _count
          include: {
            author: true,
            parent: {
              include: {
                author: true,
              },
            },
            replies: true,
            Like: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }
    
    // Add the _count field manually before caching
    const postToCache = {
      ...post,
      _count: {
        comments: await prisma.comment.count({ where: { postId: post.id } }),
        likes: post.likes.length,
      },
    };

    // Cache the fetched post with the _count field
    await redisSet(redisKey, postToCache);

    return Response.json(postToCache, { status: 200 });

  } catch (error) {
    console.error("Error fetching post:", error);
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}