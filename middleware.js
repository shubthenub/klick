import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware({
  afterAuth(auth, req) {
    const { userId } = auth;

    // If the user is not authenticated and is not already on the sign-in page, redirect to sign-in
    if (!userId && !req.nextUrl.pathname.startsWith('/sign-in')) {
      const signInUrl = new URL('/sign-in', req.nextUrl.origin);
      return Response.redirect(signInUrl);
    }
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};


// import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// const isPublicRoute = createRouteMatcher([
//   "/",
//   "/sign-in(.*)",
//   "/sign-up(.*)",
//   "/api(.*)",
//   "/favicon.ico",
//   "/_next(.*)",
// ]);

// export default clerkMiddleware((auth, req) => {
//   // ✅ Only protect private frontend routes
//   if (!isPublicRoute(req)) {
//     return auth.protect({
//       unauthorizedUrl: "/sign-in",
//     });
//   }
// });


// export const config = {
//   matcher: [
//     '/((?!_next/image|_next/static|favicon.ico).*)',
//   ],
// };
