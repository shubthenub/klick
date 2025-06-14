// import { clerkMiddleware } from '@clerk/nextjs/server';

// export default clerkMiddleware({
//   afterAuth(auth, req) {
//     const { userId } = auth;

//     // If the user is not authenticated and is not already on the sign-in page, redirect to sign-in
//     if (!userId && !req.nextUrl.pathname.startsWith('/sign-in')) {
//       const signInUrl = new URL('/sign-in', req.nextUrl.origin);
//       return Response.redirect(signInUrl);
//     }
//   },
// });

// export const config = {
//   matcher: [
//     // Skip Next.js internals and all static files, unless found in search params
//     '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
//     // Always run for API routes
//     '/(api|trpc)(.*)',
//   ],
// };


import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Create a function that matches public routes.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware((auth, req) => {
  // Protect all routes that are not public
  if (!isPublicRoute(req)) {
    auth.protect();
  }
});

export const config = {
  // The matcher ensures the middleware runs on all routes
  // except for static assets and _next internals.
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

