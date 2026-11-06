import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static site: no server, deployable to any free static host.
  output: "export",
  // Default image optimization needs a server. Open Library serves its own
  // cover sizes (-S/-M/-L), so we use those directly.
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
