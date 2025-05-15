import React from "react";
import css from "@/styles/homeView.module.css";
import PostGenerator from "@/components/PostGenerator";
import Posts from "@/components/Posts";
import PopularTrends from "@/components/PopularTrends";
import FollowSuggestions from "@/components/FollowSuggestions";
import { useUser } from "@clerk/nextjs";

const HomeView = () => {
  const {user: currentUser} = useUser()
  return (
    <div className={css.wrapper}>
      <div className={css.postsArea}>
        <PostGenerator />
        {/* posts area */}
        <Posts/>
      </div>
      <div className={css.rightSide}>
        <PopularTrends />
        <FollowSuggestions id={currentUser?.id}/>
      </div>
    </div>
  );
};

export default HomeView;
