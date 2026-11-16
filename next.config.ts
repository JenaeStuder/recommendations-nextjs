import type { NextConfig } from "next";

// On GitHub Pages a project site lives at https://<user>.github.io/<repo-name>/, not at the root, so
// pages and assets need that prefix. GitHub Actions sets GITHUB_REPOSITORY ("user/repo"); on your
// machine it's unset, so `pnpm dev` and `pnpm build` keep serving from "/". A custom domain at the
// root would need no prefix (remove this).
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePath = repo ? `/${repo}` : "";

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: basePath || undefined,
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
