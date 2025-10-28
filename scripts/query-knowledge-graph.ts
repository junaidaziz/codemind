#!/usr/bin/env ts-node
/**
 * Simple CLI to query the AI knowledge graph.
 * Usage examples:
 *   pnpm ts-node scripts/query-knowledge-graph.ts --type Service
 *   pnpm ts-node scripts/query-knowledge-graph.ts --node service_AIModelService
 *   pnpm ts-node scripts/query-knowledge-graph.ts --search embedding
 *   pnpm ts-node scripts/query-knowledge-graph.ts --neighbors service_FullRepositoryIndexer
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface GraphNode { id: string; type: string; name?: string; file?: string; description?: string }
interface GraphEdge { from: string; to: string; type: string; note?: string }
interface Graph { nodes: GraphNode[]; edges: GraphEdge[]; notes?: string[] }

function loadGraph(): Graph {
  const __filename = fileURLToPath(import.meta.url);
  const __dirnameSafe = path.dirname(__filename);
  const p = path.resolve(__dirnameSafe, '../docs/ai-knowledge-graph.json');
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const args: Record<string,string|boolean> = {};
  for (let i=0;i<argv.length;i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/,'');
      const val = argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

function main() {
  const g = loadGraph();
  const args = parseArgs();
  if (args.type) {
    const nodes = g.nodes.filter(n => n.type.toLowerCase() === String(args.type).toLowerCase());
    console.log(JSON.stringify(nodes, null, 2));
    return;
  }
  if (args.node) {
    const id = String(args.node);
    const node = g.nodes.find(n => n.id === id);
    if (!node) { console.error('Node not found'); process.exit(1); }
    const incoming = g.edges.filter(e => e.to === id);
    const outgoing = g.edges.filter(e => e.from === id);
    console.log(JSON.stringify({ node, incoming, outgoing }, null, 2));
    return;
  }
  if (args.neighbors) {
    const id = String(args.neighbors);
    const relatedIds = new Set<string>();
    g.edges.forEach(e => { if (e.from === id) relatedIds.add(e.to); if (e.to === id) relatedIds.add(e.from); });
    const neighbors = g.nodes.filter(n => relatedIds.has(n.id));
    console.log(JSON.stringify({ target: id, neighbors }, null, 2));
    return;
  }
  if (args.search) {
    const q = String(args.search).toLowerCase();
    const nodes = g.nodes.filter(n => (n.name||'').toLowerCase().includes(q) || (n.file||'').toLowerCase().includes(q) || (n.description||'').toLowerCase().includes(q));
    const edges = g.edges.filter(e => e.type.toLowerCase().includes(q) || (e.note||'').toLowerCase().includes(q));
    console.log(JSON.stringify({ nodes, edges }, null, 2));
    return;
  }
  console.log('No query provided. Use --type, --node, --neighbors, or --search.');
}

main();
