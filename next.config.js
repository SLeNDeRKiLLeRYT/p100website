// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // NO 'output: export' here!

  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // This is the correct configuration for next start
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ddejzyoxrbccpickqakz.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
    ],
    // These settings are used by the production server
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

module.exports = nextConfig;