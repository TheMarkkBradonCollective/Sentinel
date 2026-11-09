import type { NextConfig } from "next";

// OpenNext packages `.next/standalone`. `output: "standalone"` makes `next build`
// produce that tree, including when CI later runs `opennextjs-cloudflare build --skipNextBuild`.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
};
export default nextConfig;