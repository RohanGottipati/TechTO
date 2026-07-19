/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production browser-test output away from a concurrently running
  // development server's .next directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
