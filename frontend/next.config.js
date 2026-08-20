/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: '1.5.0',
  },
}

module.exports = nextConfig