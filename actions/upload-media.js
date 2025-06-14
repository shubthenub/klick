"use server";

import { uploadFile } from "@/actions/uploadFile";

export const uploadMultipleMedia = async (files) => {
  try {
    const uploads = await Promise.all(
      files.map(async ({ file, filename }) => {
        const base64 = Buffer.from(file).toString("base64");
        const mimeType = getMimeType(filename);
        const dataUri = `data:${mimeType};base64,${base64}`;
        const res = await uploadFile(dataUri, "chatmedia");
        return res;
      })
    );

    return uploads;
  } catch (e) {
    console.error("Upload error:", e);
    return [];
  }
};

function getMimeType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
  };
  return map[ext] || "application/octet-stream";
}
