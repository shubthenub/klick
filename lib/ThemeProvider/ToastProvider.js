"use client";
import { Toaster } from "react-hot-toast";
import { useSettings } from "@/context/settings/settings-context";

export const ToastProvider = () => {
  const {
    settings: { theme: globalTheme },
  } = useSettings();

  // Debugging: Log the current theme
  console.log("Current theme:", globalTheme);

  return (
    <Toaster
      toastOptions={{
        style: {
          background: globalTheme === "dark" ? "#1a1a1a" : "#fff", // Grayish in dark mode, white in light mode
          color: globalTheme === "dark" ? "#fff" : "#000", // White text in dark mode, black text in light mode
          borderRadius: "8px", // Optional: Add rounded corners
          border: globalTheme === "dark" ? "1px solid #333" : "1px solid #ddd", // Optional: Add a border
        },
        iconTheme: {
          primary: globalTheme === "dark" ? "#fff" : "#000", // Icon color
          secondary: globalTheme === "dark" ? "#1a1a1a" : "#fff", // Icon background color
        },
      }}
    />
  );
};