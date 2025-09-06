// import prisma from '../lib/prisma.js';
// import redis from '../lib/redis.js';
// import { redisGet, redisSet } from '../lib/redisSet.js';

// const PAGE_SIZE = 10;
// const POST_TTL = 600; // seconds

// async function warmUserFeed(userId) {
//   // Step 1: Get only following + self IDs (minimal query)
//   const following = await prisma.follow.findMany({
//     where: { followerId: userId },
//     select: { followingId: true },
//   });
//   const followingIds = following.map((user) => String(user.followingId));
//   const allIds = [...new Set([...followingIds, String(userId)])];

//   // Step 2: Fetch only post IDs for first page (super lightweight)
//   const postIds = await prisma.post.findMany({
//     select: { id: true }, // ✅ Only fetch IDs
//     where: { authorId: { in: allIds } },
//     take: PAGE_SIZE,
//     orderBy: { createdAt: "desc" }
//   });

//   if (postIds.length === 0) return;

//   // Step 3: Check Redis for missing posts in parallel
//   const cacheChecks = await Promise.all(
//     postIds.map(async ({ id }) => {
//       const postKey = `post:${id}`;
//       const cached = await redisGet(postKey);
//       return { id, isCached: !!cached };
//     })
//   );

//   // Step 4: Get IDs of missing posts
//   const missingPostIds = cacheChecks
//     .filter(({ isCached }) => !isCached)
//     .map(({ id }) => id);

//   if (missingPostIds.length === 0) {
//     console.log(`✅ All posts for user ${userId} already cached`);
//     return;
//   }

//   // Step 5: Fetch full post data ONLY for missing posts
//   const missingPosts = await prisma.post.findMany({
//     include: {
//       author: true,
//       likes: true,
//       comments: {
//         where: { parentId: null },
//         orderBy: { createdAt: 'desc' },
//         take: 1,
//         include: {
//           author: true,
//           _count: { select: { replies: true, Like: true } },
//         },
//       },
//       _count: {
//         select: { comments: true } // <-- add this
//       },
//     },
//     where: { id: { in: missingPostIds } }
//   });

//   // Step 6: Cache the missing posts
//   await Promise.all(
//     missingPosts.map(async (post) => {
//       const postKey = `post:${post.id}`;
//       await redisSet(postKey, JSON.stringify(post), POST_TTL);
//       console.log(`cached ${postKey}`);
//     })
//   );

//   console.log(`📊 User ${userId}: ${missingPosts.length}/${postIds.length} posts cached`);
// }

// async function main() {
//   console.time('warm-posts');

//   const users = await prisma.user.findMany({ select: { id: true } });
//   console.log(`🚀 Warming cache for ${users.length} users...`);

//   // Process users in batches to avoid overwhelming Redis
//   const BATCH_SIZE = 10;
//   for (let i = 0; i < users.length; i += BATCH_SIZE) {
//     const batch = users.slice(i, i + BATCH_SIZE);

//     await Promise.all(
//       batch.map(async (u) => {
//         try {
//           await warmUserFeed(u.id);
//         } catch (err) {
//           console.error(`❌ Failed for user ${u.id}:`, err.message);
//         }
//       })
//     );

//     console.log(`📈 Processed batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(users.length / BATCH_SIZE)}`);
//   }

//   await prisma.$disconnect();
//   await redis.quit();

//   console.timeEnd('warm-posts');
//   console.log('🎉 Cache warming complete!');
// }

// main().catch((e) => {
//   console.error('💥 Script failed:', e);
//   process.exit(1);
// });


// starrt from here 
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { redisGet, redisSet } from '../lib/redisSet.js';

const PAGE_SIZE = 5;
const POST_TTL = 6000; // seconds
const FEED_TTL = 6000; // seconds for the feed ID list

async function warmUserFeed(userId) {
  // Step 1: Get only following + self IDs (minimal query)
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const followingIds = following.map((user) => String(user.followingId));
  const allIds = [...new Set([...followingIds, String(userId)])];

  // Step 2: Fetch only post IDs for first page (super lightweight)
  const postIds = await prisma.post.findMany({
    select: { id: true }, // ✅ Only fetch IDs
    where: { authorId: { in: allIds } },
    take: PAGE_SIZE,
    orderBy: { createdAt: "desc" }
  });

  // Add this line to create the key for the feed ID list
  const feedKey = `feed:${userId}:first:${PAGE_SIZE}`;

  if (postIds.length === 0) {
    // If there are no posts, cache an empty array for the feed key
    await redisSet(feedKey, "[]", FEED_TTL);
    return;
  }

  // Step 3: Check Redis for missing posts in parallel
  const cacheChecks = await Promise.all(
    postIds.map(async ({ id }) => {
      const postKey = `post:${id}`;
      const cached = await redisGet(postKey);
      return { id, isCached: !!cached };
    })
  );

  // Step 4: Get IDs of missing posts
  const missingPostIds = cacheChecks
    .filter(({ isCached }) => !isCached)
    .map(({ id }) => id);

  // Step 5: Fetch full post data ONLY for missing posts
  if (missingPostIds.length > 0) {
    const missingPosts = await prisma.post.findMany({
      include: {
        author: true,
        likes: true,
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            author: true,
            _count: { select: { replies: true, Like: true } },
          },
        },
        _count: {
          select: { comments: true }
        },
      },
      where: { id: { in: missingPostIds } }
    });

    // Step 6: Cache the missing posts individually
    await Promise.all(
      missingPosts.map(async (post) => {
        const postKey = `post:${post.id}`;
        await redisSet(postKey, JSON.stringify(post), POST_TTL);
        console.log(`cached ${postKey}`);
      })
    );
  }

  // ✅ NEW STEP: Cache the list of post IDs with metadata for the feed key.
  const postIdsToCache = postIds.map(p => p.id);
  
  // Check if there might be more posts beyond the current page
  const hasMore = postIds.length === PAGE_SIZE;
  const lastPost = postIds.length > 0 ? postIds[postIds.length - 1] : null;
  
  const feedResult = {
    postIds: postIdsToCache,
    cursor: lastPost?.id || null,
    hasMore: hasMore,
    timestamp: Date.now()
  };
  
  await redisSet(feedKey, feedResult, FEED_TTL);
  console.log(`📊 User ${userId}: ${missingPostIds.length}/${postIds.length} posts cached, feed with metadata warmed`, {
    hasMore,
    cursor: lastPost?.id
  });
}

async function main() {
  console.time('warm-posts');

  const users = await prisma.user.findMany({ select: { id: true } });
  console.log(`🚀 Warming cache for ${users.length} users...`);

  // Process users in batches to avoid overwhelming Redis
  const BATCH_SIZE = 10;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (u) => {
        try {
          await warmUserFeed(u.id);
        } catch (err) {
          console.error(`❌ Failed for user ${u.id}:`, err.message);
        }
      })
    );

    console.log(`📈 Processed batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(users.length / BATCH_SIZE)}`);
  }

  await prisma.$disconnect();
  await redis.quit();

  console.timeEnd('warm-posts');
  console.log('🎉 Cache warming complete!');
}

main().catch((e) => {
  console.error('💥 Script failed:', e);
  process.exit(1);
});
