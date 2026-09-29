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

const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  async headers() {
    // Never let the phone cache the version probe, or updates would go unnoticed.
    return [{ source: "/version.json", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] }];
  },
};

module.exports = nextConfig;
