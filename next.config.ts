import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};
module.exports = {
  allowedDevOrigins: ["172.20.10.7", "192.168.0.40", "192.168.0.45"],
};
export default nextConfig;
