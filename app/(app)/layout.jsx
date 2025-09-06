"use client"; // Ensure this is a Client Component

import Box from "@/components/Box/Box";
import { SettingsContextProvider } from "@/context/settings/settings-provider";
import { ThemeProvider } from "@/lib/ThemeProvider";
import React from "react";
import css from "@/styles/homeLayout.module.css";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/lib/ThemeProvider/ToastProvider"; // Import the new ToastProvider
import { HydrationBoundary, QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import { App } from "antd";
import PusherInitializer from "@/components/PusherInitializer";
import PostModal from "@/components/postModal";

const queryClient = new QueryClient(); // Ensure QueryClient is created on the client side

const HomeLayout = ({ children }) => {
  return (
    <SettingsContextProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <PusherInitializer/>
            <App>
              <Box
                type="baseBg"
                style={{
                  position: "relative",
                  width: "100vw",
                  height: "100vh",
                }}
              >
                <div className={css.wrapper}>
                  <Header />

                  <div className={css.container}>
                    <Sidebar />
                    <div className={css.page_body}>
                      {children}
                      <PostModal/>
                      </div>
                  </div>
                </div>
              </Box>
              <ToastProvider /> {/* Replace <Toaster /> with <ToastProvider /> */}
            </App>
          </HydrationBoundary>
        </QueryClientProvider>
      </ThemeProvider>
    </SettingsContextProvider>
  );
};

export default HomeLayout;