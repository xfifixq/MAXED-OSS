'use client';

import BookkeepingPage from '@/app/dashboard/bookkeeping/page';
import ChatPage from '@/app/dashboard/chat/page';
import CRMPage from '@/app/dashboard/crm/page';
import DocumentsPage from '@/app/dashboard/documents/page';
import InvoicingPage from '@/app/dashboard/invoicing/page';
import ProposalsPage from '@/app/dashboard/proposals/page';
import ReportingPage from '@/app/dashboard/reporting/page';
import TimeTrackingPage from '@/app/dashboard/time-tracking/page';
import WorkflowsPage from '@/app/dashboard/workflows/page';
import { WorkspaceEmpty } from './WorkspaceShell';

type LegacyService =
  | 'paperless'
  | 'invoiceninja'
  | 'bigcapital'
  | 'docuseal'
  | 'metabase'
  | 'n8n'
  | 'mattermost'
  | 'kimai'
  | 'twenty';

const LEGACY_WORKSPACE_MAP: Record<LegacyService, () => JSX.Element> = {
  paperless: DocumentsPage,
  invoiceninja: InvoicingPage,
  bigcapital: BookkeepingPage,
  docuseal: ProposalsPage,
  metabase: ReportingPage,
  n8n: WorkflowsPage,
  mattermost: ChatPage,
  kimai: TimeTrackingPage,
  twenty: CRMPage,
};

export default function ServiceWorkspace({ service }: { service: LegacyService }) {
  const Page = LEGACY_WORKSPACE_MAP[service];

  if (!Page) {
    return (
      <WorkspaceEmpty
        title="Workspace retired"
        message="This legacy service wrapper has been removed. Open the matching native Maxed workspace instead."
      />
    );
  }

  return <Page />;
}
