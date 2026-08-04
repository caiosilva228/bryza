import type { NextConfig } from "next";

const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID
  || process.env.DEPLOY_ID
  || process.env.BUILD_ID
  || process.env.COMMIT_REF
  || undefined;

const nextConfig: NextConfig = {
  deploymentId,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
