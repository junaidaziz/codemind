// APR Orchestrator - Temporarily disabled for deployment
export interface APRConfig {
  projectId: string;
  userId: string;
  issueDescription: string;
}

export interface APRResult {
  success: boolean;
  sessionId: string;
  message: string;
}

export async function createAutonomousPR(_config: APRConfig): Promise<APRResult> {
  throw new Error('APR functionality temporarily disabled');
}

export async function getAPRSession(_sessionId: string) {
  return null;
}

export async function listAPRSessions(_projectId: string) {
  return [];
}

export async function cancelAPRSession(_sessionId: string) {
  return null;
}
