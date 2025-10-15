import { NextResponse } from 'next/server';
import { detectSchemaDrift } from '@/lib/schema-drift';

// Simple unauthenticated endpoint for now; secure later when auth is added.
export async function GET() {
  try {
    const drift = await detectSchemaDrift();
    return NextResponse.json({
      ok: true,
      ...drift,
      guidance: {
        missingColumns: 'Apply pending Prisma migrations (prisma migrate deploy). If table naming mismatch (e.g., issues vs Issue), add @@map or rename table then re-run migrations.',
        extraColumns: 'Consider cleaning up deprecated columns or updating expected list if intentional.'
      }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
