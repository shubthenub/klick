"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Post from "@/components/Post";
import PostSkeleton from "@/components/PostSkeleton";
import HomeLayout from "../../layout";

const fetchPostById = async (id) => {
  const res = await fetch(`/api/post/${id}`);
  if (!res.ok) throw new Error("Failed to fetch post");
  return res.json();
};

const Page = () => {
  const params = useParams();
  console.log("Params:", params);
  const id = params?.postId
  console.log("Post ID:", id);

  const {
    data: postData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["post", id],
    queryFn: () => fetchPostById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  if(isLoading) {
    return <PostSkeleton />;
  }else if (error) {
    return <div>Error loading post: {error.message}</div>;
  }

  return (
    <HomeLayout>
  <div style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: "2rem",
    height: "100vh",
    overflow: "hidden", // prevents outer scrollbars
  }}>
    <div style={{
      width: "min(600px, 95vw)", // responsive max width
      height: "100%",
      overflowY: "auto", // this enables inner scroll
      padding: "1rem",
      borderRadius: "8px",
    }}>
      <Post data={postData} queryId={["post", id]} />
    </div>
  </div>
  </HomeLayout>
);
}

export default Page;
