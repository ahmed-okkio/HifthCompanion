import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// One id per deployment, shared by Next and the client (query-cache buster, PRD 0016 E5).
// ponytail: commit sha, so local rebuilds of a dirty tree share an id; fine outside prod.
const buildId =
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  (() => { try { return execSync("git rev-parse HEAD").toString().trim(); } catch { return "dev"; } })();

const nextConfig: NextConfig = {
  cacheComponents: true,
  generateBuildId: () => buildId,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
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
