"use client"

import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import TopNav from "./top-nav";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show a minimal loading state that matches the theme
  if (!mounted) {
    return (
      <div className="flex h-screen bg-white dark:bg-[#0F0F12]">
        <div className="w-64 border-r border-gray-200 dark:border-[#1F1F23] animate-pulse" />
        <div className="w-full flex flex-1 flex-col">
          <header className="h-16 border-b border-gray-200 dark:border-[#1F1F23] animate-pulse" />
          <main className="flex-1 overflow-auto p-6 bg-white dark:bg-[#0F0F12]">
            <div className="h-8 w-48 bg-gray-200 dark:bg-[#1F1F23] rounded animate-pulse mb-4" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-[#1F1F23] rounded animate-pulse" />
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F12]">
      <Toaster position="top-right" />
      <div className={`flex h-screen ${theme === "dark" ? "dark" : ""}`}>
        <Sidebar />
        <div className="w-full flex flex-1 flex-col">
          <header className="h-16 border-b border-gray-200 dark:border-[#1F1F23]">
            <TopNav />
          </header>
          <main className="flex-1 overflow-auto p-6 bg-white dark:bg-[#0F0F12]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

