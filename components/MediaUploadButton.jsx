"use client";

import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "antd";
import { uploadMultipleMedia } from "@/actions/upload-media"; // server action

export default function MediaUploadButton({ onPreview, onUpload, onUploadStatusChange }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsUploading(true);
    onUploadStatusChange?.(true); // Notify parent that upload started

    try {
      // 1. Generate local previews instantly
      const previewPromises = files.map((file, index) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              type: file.type.startsWith("image/") ? "image" : "video",
              url: reader.result, // DataURL for instant preview
              name: file.name,
              file, // keep original file for upload
              isUploading: true, // Flag to indicate this is still uploading
              uploadId: `upload-${Date.now()}-${index}`, // Unique ID for tracking
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const previews = await Promise.all(previewPromises);
      onPreview(previews); // Show previews instantly

      // 2. Start upload in background
      const uploads = files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        return {
          file: buffer,
          filename: file.name,
        };
      });
      const preparedFiles = await Promise.all(uploads);
      const results = await uploadMultipleMedia(preparedFiles);

      // 3. When upload finishes, update the previews with actual URLs
      if (results?.length) {
        const validUrls = results
          .filter((res) => res?.secure_url)
          .map((res, i) => ({
            url: res.secure_url,
            type: files[i].type.startsWith("image/") ? "image" : "video",
            name: files[i].name,
            isUploading: false,
            uploadId: previews[i].uploadId, // Use the same ID to replace preview
          }));
        onUpload(validUrls); // Replace previews with actual URLs
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      onUploadStatusChange?.(false); // Notify parent that upload finished
    }

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