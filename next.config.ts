import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Native addon: load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["@resvg/resvg-js"],
}

export default nextConfig
