import { Metadata } from 'next';
import WorkspaceDetailClient from './WorkspaceDetailClient';

export const metadata: Metadata = {
  title: 'Workspace Details | CodeMind',
  description: 'Manage your workspace and repositories',
};

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkspaceDetailClient workspaceId={id} />;
}
