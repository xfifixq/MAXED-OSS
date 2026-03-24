/** @type {import('next').NextConfig} */

// Production service URLs. `NEXT_PUBLIC_API_URL` is the Maxed gateway boundary.
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

// Always use production HTTPS URLs (overrides .env.local)
const env = { ...PROD_URLS };

const nextConfig = {
  reactStrictMode: true,
  env,
};

module.exports = nextConfig;
