import ServiceWorkspace from '@/components/ServiceWorkspace';
import { WORKSPACE_CONFIGS } from '@/lib/workspace-config';

export default function CRMPage() {
  return <ServiceWorkspace config={WORKSPACE_CONFIGS.twenty} />;
}
