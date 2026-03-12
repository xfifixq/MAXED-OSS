/** @type {import('next').NextConfig} */

// Production service URLs — override with .env.local for local development
const PROD_URLS = {
  NEXT_PUBLIC_API_URL: 'http://api.maxed.life',
  NEXT_PUBLIC_BIGCAPITAL_URL: 'http://books.maxed.life',
  NEXT_PUBLIC_PAPERLESS_URL: 'http://docs.maxed.life',
  NEXT_PUBLIC_INVOICE_NINJA_URL: 'http://billing.maxed.life',
  NEXT_PUBLIC_DOCUSEAL_URL: 'http://sign.maxed.life',
  NEXT_PUBLIC_METABASE_URL: 'http://reports.maxed.life',
  NEXT_PUBLIC_N8N_URL: 'http://flow.maxed.life',
  NEXT_PUBLIC_MATTERMOST_URL: 'http://chat.maxed.life',
  NEXT_PUBLIC_KIMAI_URL: 'http://time.maxed.life',
  NEXT_PUBLIC_TWENTY_URL: 'http://crm.maxed.life',
};

// Only apply production URLs if not already set via .env.local
const env = {};
for (const [key, value] of Object.entries(PROD_URLS)) {
  if (!process.env[key]) {
    env[key] = value;
  }
}

const nextConfig = {
  reactStrictMode: true,
  env,
};

module.exports = nextConfig;
