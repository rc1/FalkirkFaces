/** @type {import('next').NextConfig} */
const nextConfig = {
  // sharp + lancedb are native modules — keep them out of the bundle.
  serverExternalPackages: ["@lancedb/lancedb", "sharp"],
  // We serve images through /api/image, so Next's optimizer is unnecessary.
  images: { unoptimized: true },
};

export default nextConfig;
