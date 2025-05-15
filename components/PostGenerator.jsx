"use client";
import React from "react";
import css from "@/styles/postGenerator.module.css";
import Box from "./Box/Box";
import { Avatar, Button, Flex, Input, message, notification, Spin, Typography } from "antd";
import { useUser, useAuth } from "@clerk/nextjs";
import { Icon } from "@iconify/react";
import { useSettings } from "@/context/settings/settings-context";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPost } from "@/actions/post";

const PostGenerator = () => {
  const { user } = useUser();
  const  userId  = user.id;
  // "user_2rnU5LXtKyAr6tIFX7Bqm87vLpd" //issue is supabase me already exist krrha , after deleting account on clerk not gettin gdeleted from supabase, fix it !!!
  const [postText, setPostText] = React.useState("");
  const { globalTheme, postAndRemoveText } = useSettings();
  const imgInputRef = React.useRef(null);
  const videoInputRef = React.useRef(null);
  const [fileType, setFileType] = React.useState(null);
  const [selectedFile, setSelectedFile] = React.useState(null);
  console.log(userId);

  const queryClient = useQueryClient();
  const { mutate: execute, isPending } = useMutation({
      mutationFn: (data) => createPost(data , userId), // Pass data explicitly as an object
      onSuccess: () => {
          handleSuccess();
          queryClient.invalidateQueries("posts");
      },
      onError: (e) => {
          showError("Something went wrong, please try again", e);
          console.error("Mutation Error:", e); // Log the full error object
      },
  });

  const handleSuccess = () => {
    setSelectedFile(null);
    setPostText("");
    setFileType(null);
    toast.success("Post uploaded successfully 🎉");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 6 * 1024 * 1024) {
        alert("File size is too large");
        return;
      }
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        setFileType(file.type.split("/")[0]);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          setSelectedFile(reader.result); // Set selectedFile to base64-encoded string
        };
      }
      e.target.value = null; // Reset the input value
    }
  };

  const handleRemoveFile = () => {
    setFileType(null);
    setSelectedFile(null);
  };

  const showError = (message) => {
    toast.error(message);
  };

  const submitPost = () => {
    if (postText === "" && !selectedFile) {
      showError("Can't make an empty post");
      return;
    }

    // Ensure valid post data
    const postData = { postText, media: selectedFile || null , userId };

    console.log("Submitting Post:", postData); // Debugging

    execute(postData); // Execute mutation with valid post data
  };
  

  return (
    <>
    {isPending && 
     <div className={css.spinnerWrapper}>  <Spin />
    <Typography>
      Posting...
    </Typography></div>
    }  
      <div className={css.postGenWrapper}>
        <Box className={css.container}>
          <Flex vertical gap={"1rem"} align="flex-start" style={{ width: "100%" }}>
            <Flex style={{ width: "100%" }} gap={"1rem"}>
              <Avatar
                src={user?.imageUrl}
                style={{
                  width: "2.6rem",
                  height: "2.6rem",
                  boxShadow: "var(--avatar-shadow)",
                }}
              />
              <Input.TextArea
                placeholder="Share what you are thinking..."
                style={{
                  height: 80,
                  resize: "none",
                  flex: 1,
                }}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              />
            </Flex>
            {fileType && (
              <div className={css.previewContainer}>
                <button type="default" className={css.remove} style={{ position: "absolute" }}>
                  <Typography style={{ color: "white" }} className="typoSemiBold" onClick={handleRemoveFile}>
                    x
                  </Typography>
                </button>
                {fileType === "image" && (
                  <img src={selectedFile} alt="preview" className={css.preview} height={"150px"} width={"100%"} />
                )}
                {fileType === "video" && (
                  <video src={selectedFile} alt="preview" className={css.preview} height={"350px"} width={"100%"} controls />
                )}
              </div>
            )}
            <Flex className={css.bottom} justify={"space-between"} align="center">
              <Button type="text" style={{ background: "borderColor" }} onClick={() => imgInputRef.current.click()}>
                <Flex align="center" gap={"0.5rem"}>
                  <Icon icon={"solar:camera-linear"} width={"1.2rem"} color="var(--primary)" />
                  <Typography className="typoSubtitle2">Image</Typography>
                </Flex>
              </Button>
              <Button type="text" style={{ background: "borderColor" }} onClick={() => videoInputRef.current.click()}>
                <Flex align="center" gap={"0.5rem"}>
                  <Icon icon={"gridicons:video"} width={"1.2rem"} color="#5856D6" />
                  <Typography className="typoSubtitle2">Video</Typography>
                </Flex>
              </Button>
              <Button
                onClick={submitPost}
                type="primary"
                style={{
                  background: "borderColor",
                  marginLeft: "auto",
                }}
              >
                <Flex align="center" gap={"0.5rem"}>
                  <Icon icon={"iconamoon:send-fill"} width={"1.2rem"} />
                  <Typography style={{ color: "white" }} className="typoSubtitle2">
                    Post
                  </Typography>
                </Flex>
              </Button>
            </Flex>
          </Flex>
        </Box>
      </div>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        multiple={false}
        ref={imgInputRef}
        onChange={(e) => handleFileChange(e)}
      />
      <input
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        multiple={false}
        ref={videoInputRef}
        onChange={(e) => handleFileChange(e)}
      />
    </>
  );
};

export default PostGenerator;