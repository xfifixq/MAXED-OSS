import ServiceWorkspace from '@/components/ServiceWorkspace';
import { WORKSPACE_CONFIGS } from '@/lib/workspace-config';

export default function ReportingPage() {
  return <ServiceWorkspace config={WORKSPACE_CONFIGS.metabase} />;
}
