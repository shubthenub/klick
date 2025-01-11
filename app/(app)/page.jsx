"use client";
import { useSettings } from "@/context/settings/settings-context";
import React from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@clerk/nextjs";

const page = () => {
  const { isSignedIn } = useUser(); // Check if the user is signed in
  const router = useRouter(); // Next.js Router for manual redirection

  // Ensure the redirect happens only on the client side, after the component has mounted
  useEffect(() => {
    if (!isSignedIn) {
      router.push("/sign-in"); // Redirect to sign-in page if not signed in
    }
  }, [isSignedIn, router]); // Runs when the isSignedIn state changes

  // Handle sign out manually when the user clicks on the sign-out button
  const handleSignOut = async () => {
    await signOut(); // Sign the user out
    router.push("/"); // Redirect to the homepage or landing page
  };

  // Prevent rendering while checking sign-in status
  if (!isSignedIn) {
    return null; // Return nothing while redirecting
  }

  //using context for theme
  const {
    settings: { theme },
  } = useSettings();
  return (
    <>
      <div>
        <h1>{theme}</h1>
      </div>
      <div>
        <h1>Welcome to the Dashboard!</h1>
      </div>
    </>
  );
};

export default page;
