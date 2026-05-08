/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ["pdf-parse", "mammoth"] },
  images: { domains: ["lh3.googleusercontent.com"] },
};

export default nextConfig;
