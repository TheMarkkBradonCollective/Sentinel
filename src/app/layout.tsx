import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sentinel — See Everything. Build Anything.",
  description: "Your GitHub development command center. Monitor projects, builds, issues, and security from one place.",
  applicationName: "Sentinel",
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = { themeColor: "#090d16", colorScheme: "dark" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}