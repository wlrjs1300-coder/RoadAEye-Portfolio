import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  allowedDevOrigins: ["localhost"],
  outputFileTracingRoot: process.cwd(),

  webpack: (config, { isServer, webpack: wp }) => {
    if (!isServer) {
      config.plugins.push(
        new wp.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          }
        )
      );
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        https: false,
        http: false,
        net: false,
        tls: false,
        crypto: false,
        os: false,
        path: false,
        stream: false,
        buffer: false,
        util: false,
        url: false,
        zlib: false,
        child_process: false,
        events: false,
      };
    }
    return config;
  },
};

export default nextConfig;
