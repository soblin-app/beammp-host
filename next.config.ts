import type { NextConfig } from "next";

// When building for Tauri (TAURI_BUILD=1), use static export so Tauri can serve the
// frontend from its embedded assets. Otherwise keep standalone for sandbox dev mode.
const isTauriBuild = process.env.TAURI_BUILD === "1";

const nextConfig: NextConfig = {
  output: isTauriBuild ? "export" : "standalone",
  // Tauri serves from tauri://localhost (no router base path). When exporting, no trailing slash
  // so asset paths resolve correctly under file:// or tauri:// loading.
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
