/** @type {import('next').NextConfig} */
const CDN_S_MAXAGE_SECONDS = parseInt(process.env.NEXT_CDN_S_MAXAGE_SECONDS || '960', 10);
const STALE_WHILE_REVALIDATE_SECONDS = 86400;

module.exports = {
  reactStrictMode: true,
  transpilePackages: ['@signarank/client'],
  turbopack: {},
  async headers() {
    return [
      {
        source: '/address/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: `public, max-age=0, s-maxage=${CDN_S_MAXAGE_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    });
    return config;
  },
}
