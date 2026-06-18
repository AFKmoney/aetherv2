// AetherOS Pipeline Stats API

import { NextResponse } from 'next/server';
import { pipeline } from '@/lib/engine/instance';

export async function GET() {
  const stats = pipeline.getStats();
  const models = pipeline.getModels();
  const hcmStats = pipeline.getHCM().getStats();
  const distillSize = pipeline.getDistillStore().size();
  const cacheSize = pipeline.getCache().actionCache.size();

  return NextResponse.json({
    ...stats,
    hcm: hcmStats,
    distillationPatterns: distillSize,
    cacheEntries: cacheSize,
    models,
  });
}
