"use client";

import React, { useEffect, useRef, useState } from "react";

const VideoThumbnail = ({ src, width = 100, height = 100, style = {} }) => {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [thumbnail, setThumbnail] = useState(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous"; // Important for CORS
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("loadeddata", () => {
      video.currentTime = 0;
    });

    video.addEventListener("seeked", () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, width, height);
      const imageUrl = canvas.toDataURL("image/png");
      setThumbnail(imageUrl);
    });

    return () => {
      video.pause();
      video.src = "";
    };
  }, [src, width, height]);

  return (
    <>
      {thumbnail ? (
        <img
          src={thumbnail}
          alt="Video thumbnail"
          width={width}
          height={height}
          style={{ objectFit: "cover", ...style }}
        />
      ) : (
        <canvas ref={canvasRef} style={{ display: "none" }} />
      )}
    </>
  );
};

export default VideoThumbnail;
