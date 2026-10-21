/** @type {import('next').NextConfig} */
const { execSync } = require("child_process");

// Must be identical in every build worker (Date.now() is not), so derive it from the commit.
function commitId() {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
}
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || commitId();

// GitHub Pages copy: a static export served under /<repo>. Vercel builds are unchanged.
const pages = process.env.STATIC_EXPORT === "1";
const basePath = pages ? process.env.PAGES_BASE_PATH || "/mcd-macro-planner" : "";

const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: buildId, NEXT_PUBLIC_BASE_PATH: basePath },
  ...(pages ? { output: "export", basePath, trailingSlash: true, images: { unoptimized: true } } : {}),
  async headers() {
    if (pages) return [];
    // Never let the phone cache the version probe, or updates would go unnoticed.
    return [
      { source: "/version.json", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
      // The offline worker must update as soon as a new version ships.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

module.exports = nextConfig;
