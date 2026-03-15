import ServiceWorkspace from '@/components/ServiceWorkspace';
import { WORKSPACE_CONFIGS } from '@/lib/workspace-config';

export default function DocumentsPage() {
  return <ServiceWorkspace config={WORKSPACE_CONFIGS.paperless} />;
}
