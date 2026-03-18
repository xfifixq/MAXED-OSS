'use client';

export interface WorkspaceConfig {
  service: string;
  title: string;
  description?: string;
  targetPath?: string;
}

export const WORKSPACE_CONFIGS: Record<string, WorkspaceConfig> = {
  paperless: {
    service: 'paperless',
    title: 'Maxed Docs',
  },
  invoiceninja: {
    service: 'invoiceninja',
    title: 'Maxed Billing',
  },
  bigcapital: {
    service: 'bigcapital',
    title: 'Maxed Ledger',
  },
  docuseal: {
    service: 'docuseal',
    title: 'Maxed Sign',
  },
  metabase: {
    service: 'metabase',
    title: 'Maxed Analytics',
  },
  n8n: {
    service: 'n8n',
    title: 'Maxed Automations',
  },
  mattermost: {
    service: 'mattermost',
    title: 'Maxed Chat',
  },
  kimai: {
    service: 'kimai',
    title: 'Maxed Time',
  },
  twenty: {
    service: 'twenty',
    title: 'Maxed CRM',
  },
};
