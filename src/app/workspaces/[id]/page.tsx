import { Metadata } from 'next';
import WorkspaceDetailClient from './WorkspaceDetailClient';

export const metadata: Metadata = {
  title: 'Workspace Details | CodeMind',
  description: 'Manage your workspace and repositories',
};

export default function WorkspaceDetailPage({ params }: { params: { id: string } }) {
  return <WorkspaceDetailClient workspaceId={params.id} />;
}
