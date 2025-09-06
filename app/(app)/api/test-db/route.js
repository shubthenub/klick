import prisma from "@/lib/prisma.js";

export async function GET() {
  try {
    const results = {};
    
    // Test 1: Simple SELECT
    const start1 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    results.simpleSelect = Date.now() - start1;
    
    // Test 2: Table scan
    const start2 = Date.now();
    await prisma.$queryRaw`SELECT COUNT(*) FROM "User"`;
    results.userCount = Date.now() - start2;
    
    // Test 3: Indexed lookup
    const start3 = Date.now();
    await prisma.$queryRaw`SELECT id FROM "Post" WHERE id = 1`;
    results.indexedLookup = Date.now() - start3;
    
    // Test 4: Join query
    const start4 = Date.now();
    await prisma.$queryRaw`
      SELECT p.id, u.first_name 
      FROM "Post" p 
      JOIN "User" u ON p."authorId" = u.id 
      WHERE p.id = 1
    `;
    results.joinQuery = Date.now() - start4;
    
    // Test 5: Check table sizes
    const start5 = Date.now();
    const tableSizes = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE tablename IN ('Post', 'User', 'Comment', 'Like')
      ORDER BY tablename, attname
    `;
    results.statsQuery = Date.now() - start5;
    
    return Response.json({
      success: true,
      performance: results,
      tableStats: tableSizes,
      totalTime: Object.values(results).reduce((a, b) => a + b, 0)
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}