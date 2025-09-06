"use client";
import React, { useEffect, useState } from "react";
import css from "@/styles/postGenerator.module.css";
import Box from "./Box/Box";
import {
  Avatar,
  Button,
  Flex,
  Input,
  Spin,
  Typography,
} from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useUser } from "@clerk/nextjs";
import { Icon } from "@iconify/react";
import { useSettings } from "@/context/settings/settings-context";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPost, getFeed } from "@/actions/post";
import useWindowDimensions from "@/hooks/useWindowsDimension";

const PostGenerator = () => {
  const { user } = useUser();
  const userId = user?.id;
  const [postText, setPostText] = React.useState("");
  const { globalTheme } = useSettings();
  const imgInputRef = React.useRef(null);
  const videoInputRef = React.useRef(null);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const { width } = useWindowDimensions();
  const [isMobile , setIsMobile] = useState(false);
  useEffect(() => {
    if (width < 420) {
      setIsMobile(true);
    } else {
      setIsMobile(false);
    }
  },[width])
  const queryClient = useQueryClient();

const { mutate: execute, isPending } = useMutation({
  mutationFn: async (postData) => {
    const res = await fetch("/api/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postData),
    });

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error || "Post creation failed");
      return data;
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      throw new Error("Server returned invalid JSON");
    }
  },

  onSuccess: async () => {
    setPostText("");
    setSelectedFiles([]);

    // ⏳ Wait for UI to actually update
    await queryClient.invalidateQueries({ queryKey: ["posts"] });

    toast.dismiss(); // remove loading
    toast.success("Post uploaded 🎉");
  },

  onError: (e) => {
    toast.dismiss();
    toast.error("Something went wrong");
    console.error("Mutation Error:", e);
  },
});



  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    // Check if adding these files would exceed the limit
    if (selectedFiles.length + files.length > 4) {
      toast.error("Maximum 4 files allowed per post");
      e.target.value = null;
      return;
    }

    const validFiles = files
      .filter((file) => {
        if (file.size > 3 * 1024 * 1024) { // Reduced to 3MB per file
          toast.error(`${file.name} is too large (max 3MB per file)`);
          return false;
        }
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          toast.error(`${file.name} is not a valid image or video`);
          return false;
        }
        return true;
      })
      .map((file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              type: file.type.split("/")[0],
              src: reader.result,
              name: file.name,
            });
          };
          reader.onerror = () => {
            toast.error(`Error reading ${file.name}`);
            reject();
          };
          reader.readAsDataURL(file);
        });
      });

    Promise.all(validFiles)
      .then((mediaArray) => {
        setSelectedFiles((prev) => [...prev, ...mediaArray]);
      })
      .catch((err) => {
        console.error("Error reading files", err);
      });

    e.target.value = null;
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submitPost = () => {
    if (!userId) return toast.error("Login required");

    if (!postText.trim() && selectedFiles.length === 0)
      return toast.error("Can't make an empty post");

    const payload = {
      postText: postText.trim(),
      media: selectedFiles,
      userId,
    };

    execute(payload);
  };

  return (
    <>
      {/* {isPending && (
        <div className={css.spinnerWrapper}>
          <Spin indicator={<LoadingOutlined spin />} size="small" />
          <Typography>Posting...</Typography>
        </div>
      )} */}

      <div className={css.postGenWrapper}>
  <Box className={`${css.container} ${isPending ? css.disabled : ""}`}>
    <Flex vertical gap="1rem" align="flex-start" style={{ width: "100%", position: "relative" }}>
      
      {/* Avatar with spinner overlay */}
      <Flex gap="1rem" style={{ width: "100%", position: "relative" }}>
        <div style={{ position: "relative", width: "2.6rem", height: "2.6rem", display:isMobile ? "none" : "block" }}>
          <Avatar
            src={user?.imageUrl}
            style={{
              width: "2.6rem",
              height: "2.6rem",
              boxShadow: "var(--avatar-shadow)",
              display: isMobile ? "none" : "block",
              opacity: isPending ? 0.5 : 1,
            }}
          />

          {isPending && (
            <LoadingOutlined
              style={{
                fontSize: 35,
                color: "var(--primary)",
                position: "absolute",
                top: "9%",
                left: "7%",
              }}
              spin
            />
          )}
        </div>


        <Flex vertical style={{ flex: 1 }} gap="1rem">
          <Input.TextArea
            placeholder="Share what you are thinking..."
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            disabled={isPending} // ✅ Disable during upload
            style={{
              width: "100%",
              height: 80,
              resize: "none",
            }}
            maxLength={500}
            showCount={false}
          />

          {/* Action buttons */}
          <div className={css.bottom}>
            <div className={css.mediaButtons}>
              <button
                type="button"
                className={css.mediaButton}
                onClick={() => imgInputRef.current?.click()}
                disabled={isPending} // ✅ Disable button
                style={{ opacity: isPending ? 0.5 : 1 }}
              >
                <Icon icon="solar:camera-linear" width="1.2rem" color="var(--primary)" />
                <Typography className="typoSubtitle2">Image</Typography>
              </button>
              <button
                type="button"
                className={css.mediaButton}
                onClick={() => videoInputRef.current?.click()}
                disabled={isPending} // ✅ Disable button
                style={{ opacity: isPending ? 0.5 : 1 }}
              >
                <Icon icon="gridicons:video" width="1.2rem" color="#5856D6" />
                <Typography className="typoSubtitle2">Video</Typography>
              </button>
            </div>
            <Button
              type="primary"
              onClick={submitPost}
              disabled={isPending}
              size="medium"
              style={{ flexShrink: 0, opacity: isPending ? 0.7 : 1 }}
            >
              <Flex align="center" gap="0.5rem">
                <Icon icon="iconamoon:send-fill" width="1.2rem" />
                <Typography style={{ color: "white" }} className="typoSubtitle2">
                  Post
                </Typography>
              </Flex>
            </Button>
          </div>
        </Flex>
      </Flex>

      {/* Preview section with overlay when disabled */}
      {selectedFiles.length > 0 && (
        <div className={`${css.previewContainer} ${isPending ? css.previewDisabled : ""}`}>
          {selectedFiles.map((file, index) => (
            <div key={index} className={css.singlePreviewWrapper}>
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className={css.remove}
                disabled={isPending} // ✅ Disable remove
              >
                <Typography style={{ color: "white" }}>×</Typography>
              </button>
              {file.type === "image" ? (
                <img src={file.src} className={css.preview} />
              ) : (
                <video src={file.src} className={css.preview} controls />
              )}
            </div>
          ))}
          {isPending && <div className={css.overlay}></div>} {/* Overlay for preview */}
        </div>
      )}
    </Flex>
  </Box>
</div>


      <input type="file" accept="image/*" multiple style={{ display: "none" }} ref={imgInputRef} onChange={handleFileChange} />
      <input type="file" accept="video/*" multiple style={{ display: "none" }} ref={videoInputRef} onChange={handleFileChange} />
    </>
  );
};

export default PostGenerator;
