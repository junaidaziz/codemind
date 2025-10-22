import { Metadata } from 'next';
import WorkspacesClient from './WorkspacesClient';

export const metadata: Metadata = {
  title: 'Workspaces | CodeMind',
  description: 'Manage your multi-repository workspaces',
};

export default function WorkspacesPage() {
  return <WorkspacesClient />;
}
