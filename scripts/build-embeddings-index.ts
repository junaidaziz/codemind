#!/usr/bin/env ts-node
/**
 * Batch embeddings builder.
 * Scans CodeChunk rows lacking embeddings (length == 0 or null) for a project and writes vectors.
 * Usage:
 *   pnpm ts-node scripts/build-embeddings-index.ts --project <projectId> [--batchSize 50]
 */
import prisma from '../src/app/lib/db';
import { embedTexts } from '../src/app/lib/embeddings';

interface Args { project: string; batchSize: number; dryRun: boolean }
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let project = '';
  let batchSize = 50;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' && argv[i+1]) { project = argv[++i]; }
    else if (a === '--batchSize' && argv[i+1]) { batchSize = parseInt(argv[++i], 10) || batchSize; }
    else if (a === '--dryRun') { dryRun = true; }
  }
  if (!project) {
    console.error('Missing --project <projectId>');
    process.exit(1);
  }
  return { project, batchSize, dryRun };
}

async function main() {
  const { project, batchSize, dryRun } = parseArgs();
  console.log(`[embeddings] Starting for project ${project} batchSize=${batchSize} dryRun=${dryRun}`);

  // Fetch chunks without embeddings (assumes embedding stored as vector column; treat null OR zero-length JSON string)
  const chunks = await prisma.codeChunk.findMany({
    where: { projectId: project },
    select: { id: true, content: true },
    take: 5000, // safety upper bound; paginate if bigger later
  });

  // Filter by raw SQL length check for embedding column if needed (fallback simplistic here)
  const missing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
    SELECT id FROM "CodeChunk" WHERE "projectId" = '${project}' AND (embedding IS NULL OR embedding = '[]') LIMIT 10000;
  `);
  const targetIds = new Set(missing.map(m => m.id));
  const targetChunks = chunks.filter(c => targetIds.has(c.id));

  console.log(`[embeddings] Found ${targetChunks.length} chunks needing embeddings`);
  if (dryRun) {
    console.log('[embeddings] Dry run complete. Exiting.');
    process.exit(0);
  }

  let processed = 0; let embedded = 0;
  for (let i = 0; i < targetChunks.length; i += batchSize) {
    const batch = targetChunks.slice(i, i + batchSize);
    const vectors = await embedTexts(batch.map(b => b.content));
    // Update each chunk
    for (let j = 0; j < batch.length; j++) {
      const id = batch[j].id;
      const vector = vectors[j];
      // Write vector as pgvector (expects extension installed). Convert to comma-separated format inside brackets.
      await prisma.$executeRawUnsafe(`UPDATE "CodeChunk" SET embedding = '[${vector.join(',')}]'::vector WHERE id = '${id}';`);
      embedded++;
    }
    processed += batch.length;
    console.log(`[embeddings] Batch ${(i/batchSize)+1} done: processed=${processed}/${targetChunks.length}`);
  }

  console.log(`[embeddings] Completed. Embedded ${embedded} chunks.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
