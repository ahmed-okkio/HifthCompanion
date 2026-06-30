import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel's image optimizer returns 402 once the plan's optimization quota is
    // exhausted, which blanks every next/image (logo + Mushaf pages). Serve images
    // unoptimized so they load straight from source (Supabase storage / public/).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/QuranHub/quran-pages-images/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
