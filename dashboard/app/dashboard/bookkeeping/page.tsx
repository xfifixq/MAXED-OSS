import ServiceWorkspace from '@/components/ServiceWorkspace';
import { WORKSPACE_CONFIGS } from '@/lib/workspace-config';

export default function BookkeepingPage() {
  return <ServiceWorkspace config={WORKSPACE_CONFIGS.bigcapital} />;
}
