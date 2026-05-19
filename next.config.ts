import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "mapbox-gl"],
  async rewrites() {
    return [
      { source: "/miami", destination: "/redesign" },
      { source: "/miami/:path*", destination: "/redesign/:path*" },
    ];
  },
  ...(isGitHubPages && {
    output: "export",
    basePath: "/parent_picker",
    images: { unoptimized: true },
  }),
};

export default nextConfig;
