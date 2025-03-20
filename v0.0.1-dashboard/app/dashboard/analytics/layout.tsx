import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics",
  description: "View your spending analytics and insights.",
};

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 