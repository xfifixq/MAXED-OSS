/** @type {import('next').NextConfig} */

// Production service URLs — override with .env.local for local development
const PROD_URLS = {
  NEXT_PUBLIC_API_URL: 'https://api.maxed.life',
  NEXT_PUBLIC_BIGCAPITAL_URL: 'https://books.maxed.life',
  NEXT_PUBLIC_PAPERLESS_URL: 'https://docs.maxed.life',
  NEXT_PUBLIC_INVOICE_NINJA_URL: 'https://billing.maxed.life',
  NEXT_PUBLIC_DOCUSEAL_URL: 'https://sign.maxed.life',
  NEXT_PUBLIC_METABASE_URL: 'https://reports.maxed.life',
  NEXT_PUBLIC_N8N_URL: 'https://flow.maxed.life',
  NEXT_PUBLIC_MATTERMOST_URL: 'https://chat.maxed.life',
  NEXT_PUBLIC_KIMAI_URL: 'https://time.maxed.life',
  NEXT_PUBLIC_TWENTY_URL: 'https://crm.maxed.life',
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
