// AetherOS Models API — List available models

import { NextResponse } from 'next/server';
import { pipeline } from '@/lib/engine/instance';

export async function GET() {
  const models = pipeline.getModels();

  return NextResponse.json({
    object: 'list',
    data: models.map(m => ({
      id: m.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: m.provider,
      aether: {
        name: m.name,
        type: m.type,
        capabilities: m.capabilities,
        costPerToken: m.costPerToken,
      },
    })),
  });
}
