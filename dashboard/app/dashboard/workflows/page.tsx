import ServiceWorkspace from '@/components/ServiceWorkspace';
import { WORKSPACE_CONFIGS } from '@/lib/workspace-config';

export default function WorkflowsPage() {
  return <ServiceWorkspace config={WORKSPACE_CONFIGS.n8n} />;
}
