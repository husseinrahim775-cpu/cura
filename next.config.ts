import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  //assetPrefix: '.', // نقطة واحدة فقط أو صيغة نسبية
  trailingSlash: true,
};

export default nextConfig;
