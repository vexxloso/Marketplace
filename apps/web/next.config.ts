import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Must match nginx `location /market` (see deploy/nginx-snippet.conf). */
  basePath: "/market",
};

export default nextConfig;
