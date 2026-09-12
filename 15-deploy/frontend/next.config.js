const checkEnvVariables = require("./check-env-variables")
const { createKitNextConfig } = require("@pradip1995/create-storefront/lib/kit-next-config")

checkEnvVariables()

const projectRoot = __dirname

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * Extract backend URL hostname from environment variables
 */
const getBackendHostname = () => {
  const backendUrl = process.env.FILE_LOCAL_BACKEND_URL || "https://localhost:9000"
  try {
    const url = new URL(backendUrl)
    return url.hostname
  } catch {
    return null
  }
}

const BACKEND_HOSTNAME = getBackendHostname()
console.log("BACKEND_HOSTNAME", BACKEND_HOSTNAME)

/** @type {import('next').NextConfig} */
module.exports = createKitNextConfig(projectRoot, {
  customerDataPath: "src/lib/data/customer.ts",
  googleOAuthProviderShimPath: "src/lib/util/google-oauth-provider-shim.ts",
  extra: {
    reactStrictMode: true,
    logging: {
      fetches: {
        fullUrl: true,
      },
    },
    experimental: {
      serverActions: {
        bodySizeLimit: "10mb",
      },
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: true,
    },
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "images.unsplash.com",
        },
        {
          protocol: "http",
          hostname: "localhost",
        },
        {
          protocol: "https",
          hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
        },
        {
          protocol: "https",
          hostname: "medusa-server-testing.s3.amazonaws.com",
        },
        {
          protocol: "https",
          hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
        },
        {
          protocol: "https",
          hostname: "chocomelon.s3.ap-south-1.amazonaws.com",
        },
        {
          protocol: "https",
          hostname: "chocomelon-1.s3.ap-south-1.amazonaws.com",
        },
        {
          protocol: "https",
          hostname: "culturajewels.com",
        },
        {
          protocol: "https",
          hostname: "www.culturajewels.com",
        },
        {
          protocol: "https",
          hostname: "ik.imagekit.io",
        },
        {
          protocol: "http",
          hostname: "ik.imagekit.io",
        },
        ...(BACKEND_HOSTNAME && BACKEND_HOSTNAME !== "localhost"
          ? [
              {
                protocol: "https",
                hostname: BACKEND_HOSTNAME,
              },
              {
                protocol: "http",
                hostname: BACKEND_HOSTNAME,
              },
            ]
          : []),
        ...(S3_HOSTNAME && S3_PATHNAME
          ? [
              {
                protocol: "https",
                hostname: S3_HOSTNAME,
                pathname: S3_PATHNAME,
              },
            ]
          : []),
      ],
    },
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
          ],
        },
      ]
    },
  },
})
