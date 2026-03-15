'use client';

export interface WorkspaceConfig {
  service: string;
  title: string;
  description: string;
  launchLabel: string;
  targetPath?: string;
}

export const WORKSPACE_CONFIGS: Record<string, WorkspaceConfig> = {
  paperless: {
    service: 'paperless',
    title: 'Maxed Docs',
    description: 'Full document management workspace inside Maxed.',
    launchLabel: 'Open Full Workspace',
  },
  invoiceninja: {
    service: 'invoiceninja',
    title: 'Maxed Billing',
    description: 'Full billing and receivables workspace inside Maxed.',
    launchLabel: 'Open Full Workspace',
  },
  bigcapital: {
    service: 'bigcapital',
    title: 'Maxed Ledger',
    description: 'Full bookkeeping and general ledger workspace inside Maxed.',
    launchLabel: 'Open Full Workspace',
  },
  docuseal: {
    service: 'docuseal',
    title: 'Maxed Sign',
    description: 'Full proposals and e-signature workspace inside Maxed.',
    launchLabel: 'Open Full Workspace',
  },
  metabase: {
    service: 'metabase',
    title: 'Maxed Analytics',
    description: 'Full reporting and analytics workspace inside Maxed.',
    launchLabel: 'Open Full Workspace',
  },
  n8n: {
    service: 'n8n',
    title: 'Maxed Automations',
    description: 'Full workflow automation workspace inside Maxed.',
    launchLabel: 'Open Full Workspace',
  },
  mattermost: {
    service: 'mattermost',
    title: 'Maxed Chat',
    description: 'Full team communication workspace inside Maxed.',
    launchLabel: 'Open Full Workspace',
  },
  kimai: {
    service: 'kimai',
    title: 'Maxed Time',
    description: 'Full time tracking workspace inside Maxed.',
    launchLabel: 'Open Full Workspace',
  },
  twenty: {
    service: 'twenty',
    title: 'Maxed CRM',
    description: 'Full CRM workspace inside Maxed.',
    launchLabel: 'Open Full Workspace',
  },
};
