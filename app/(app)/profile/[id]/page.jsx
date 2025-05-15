// /profile/[id]/page.js
import ProfileView from "@/sections/ProfileView/view/ProfileView";
import React from "react";

// ✅ This is how to correctly destructure and use params
export function generateMetadata({ searchParams, params }) {
  console.log("User ID:", params.id);
  console.log(searchParams?.person)
  return {
    title: `${searchParams?.person || "User"}'s Profile`,
    description: `Profile Page of ${params.id}`,
  };
}

// ✅ Correct destructuring in the component too
const ProfilePage = ({ params }) => {
  console.log("Inside ProfilePage:", params.id); // Now this will also work
  return <ProfileView userId={params.id} />;
};

export default ProfilePage;
