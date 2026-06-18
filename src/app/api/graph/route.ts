// AetherOS Graph API — Semantic Memory Graph management
// Add, search, clear, export, import nodes

import { NextRequest, NextResponse } from 'next/server';
import { pipeline } from '@/lib/engine/instance';

// GET: Full graph or stats
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  const graph = pipeline.getGraph();

  if (action === 'stats') {
    return NextResponse.json({
      nodeCount: graph.getNodeCount(),
      edgeCount: graph.getEdgeCount(),
    });
  }

  // Default: return full graph for visualization
  const data = graph.getGraph();
  return NextResponse.json(data);
}

// POST: Add node, search, clear, import
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const graph = pipeline.getGraph();

    switch (body.action) {
      case 'add': {
        const node = graph.add({
          text: body.text,
          category: body.category,
          id: body.id,
        });
        // Also fold into HCM
        pipeline.getHCM().write(node.id, node.text);
        return NextResponse.json({ success: true, node: { id: node.id, text: node.text, category: node.category } });
      }

      case 'search': {
        const results = graph.search(body.query, body.topN || 8);
        return NextResponse.json({
          results: results.map(r => ({
            id: r.node.id,
            text: r.node.text,
            category: r.node.category,
            score: r.score,
          })),
        });
      }

      case 'retrieve': {
        const results = graph.retrieve(body.query, body.topN || 8);
        return NextResponse.json({
          results: results.map(r => ({
            id: r.node.id,
            text: r.node.text,
            category: r.node.category,
            score: r.score,
          })),
        });
      }

      case 'clear': {
        graph.clear();
        return NextResponse.json({ success: true, message: 'Graph cleared' });
      }

      case 'import': {
        const nodes = body.nodes as Array<{ text: string; category?: string; id?: string }>;
        const imported = [];
        for (const n of nodes) {
          const node = graph.add({ text: n.text, category: n.category as any, id: n.id });
          imported.push({ id: node.id, text: node.text });
        }
        return NextResponse.json({ success: true, imported: imported.length });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Graph API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
