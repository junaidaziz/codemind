import prisma from '@/lib/db';

export interface DriftColumn {
  table: string;
  column: string;
  expected?: boolean; // whether defined in prisma schema (we infer by querying Prisma's information_schema)
  actual?: boolean;   // whether exists physically
  dataType?: string | null;
}

export interface DriftResult {
  missingColumns: DriftColumn[]; // defined in schema, not in DB
  extraColumns: DriftColumn[];   // exist in DB, not in schema (best-effort)
  tablesChecked: string[];
  timestamp: string;
}

/**
 * Lightweight schema drift checker to detect missing columns that cause Prisma runtime errors (e.g., P2022).
 * Only inspects tables we actively rely on for analytics & AI (Project, Issue, PullRequest, CodeChunk).
 */
export async function detectSchemaDrift(): Promise<DriftResult> {
  // NOTE: We do not have direct programmatic access to the parsed Prisma schema models at runtime.
  // Instead we encode expected columns for key tables manually. Update if schema evolves.
  const expected: Record<string, string[]> = {
    Project: ['id','name','createdAt','updatedAt','defaultBranch','githubUrl','lastIndexedAt','ownerId','status','visibility','lastFullScanAt','organizationId'],
    Issue: ['id','projectId','number','title','body','state','htmlUrl','authorLogin','authorUrl','assignees','labels','createdAt','updatedAt','closedAt','aiAnalyzed','aiAnalyzedAt','aiSummary','aiFixPrUrl'],
    PullRequest: ['id','projectId','number','title','body','state','htmlUrl','headBranch','baseBranch','authorLogin','authorUrl','createdAt','updatedAt','closedAt','mergedAt','draft','mergeable','labels','additions','deletions','changedFiles','reviewComments','isAiGenerated','contributorId'],
    CodeChunk: ['id','projectId','path','sha','language','startLine','endLine','content','tokenCount','embedding','updatedAt','projectFileId']
  };

  // Map model -> physical table name (adjust if you add @@map in schema)
  const tableMap: Record<string,string> = {
    Project: 'Project',
    Issue: 'Issue',
    PullRequest: 'PullRequest',
    CodeChunk: 'CodeChunk'
  };

  const missingColumns: DriftColumn[] = [];
  const extraColumns: DriftColumn[] = [];

  for (const model of Object.keys(expected)) {
    const table = tableMap[model];
    try {
      const cols = await prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
        table
      );
      const actualSet = new Set(cols.map(c => c.column_name));
      const expectedCols = expected[model];

      // Missing: expected not in actual
      for (const col of expectedCols) {
        if (!actualSet.has(col)) {
          missingColumns.push({ table, column: col, expected: true, actual: false });
        }
      }
      // Extra: actual not in expected
      for (const col of actualSet) {
        if (!expectedCols.includes(col)) {
          const info = cols.find(c => c.column_name === col);
          extraColumns.push({ table, column: col, expected: false, actual: true, dataType: info?.data_type || null });
        }
      }
    } catch (err) {
      // Table might not exist at all
      missingColumns.push(...expected[model].map(col => ({ table, column: col, expected: true, actual: false })));
    }
  }

  return {
    missingColumns,
    extraColumns,
    tablesChecked: Object.values(tableMap),
    timestamp: new Date().toISOString()
  };
}
