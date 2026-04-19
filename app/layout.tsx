import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "生产排产系统 | 康乃尔新材料",
  description: "Cornell New Materials 生产排产与产能可视化平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
