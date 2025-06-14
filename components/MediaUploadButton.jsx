"use client";

import { useRef } from "react";
import { Icon } from "@iconify/react";
import { Button } from "antd";
import { uploadMultipleMedia } from "@/actions/upload-media"; // server action

export default function MediaUploadButton({ onUpload }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    const uploads = Array.from(files).map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      return {
        file: buffer,
        filename: file.name,
      };
    });

    const preparedFiles = await Promise.all(uploads);
    const results = await uploadMultipleMedia(preparedFiles);

    // Pass array of URLs to parent
    if (results?.length) {
      const validUrls = results
        .filter((res) => res?.secure_url)
        .map((res) => res.secure_url);
      onUpload(validUrls);
    }

    // Reset the input to allow re-selecting the same files again
    e.target.value = "";
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*"
        style={{ display: "none" }}
        multiple
        onChange={handleChange}
      />
      <Button
        icon={<Icon icon="ic:round-add-photo-alternate" />}
        onClick={handleClick}
      />
    </>
  );
}
