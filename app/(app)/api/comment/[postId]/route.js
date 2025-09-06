import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req, { params }) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const parentId = searchParams.get('parentId'); // For replies
    const skip = (page - 1) * limit;

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    // Build where clause
    const where = {
      postId: parseInt(postId),
      parentId: parentId ? parseInt(parentId) : null
    };

    // Get comments with pagination
    const comments = await prisma.comment.findMany({
      where,
      include: {
  author: {
    select: {
      id: true,
      username: true,
      image_url: true,
    }
  },
  parent: { // Include parent info if it's a reply
    select: {
      id: true,
      author: {
        select: {
          username: true
        }
      }
    }
  },
  Like: {
    where: { type: 'COMMENT' },
    select: { authorId: true }
  },
  _count: {
    select: {
      replies: true,
      Like: { where: { type: 'COMMENT' } }
    }
  }
}
,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    // Get total count for pagination
    const total = await prisma.comment.count({ where });

    return NextResponse.json({
      comments,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + limit < total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}