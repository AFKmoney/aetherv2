// AetherOS Inference API — Model management and status

import { NextRequest, NextResponse } from 'next/server';
import { inferenceEngine } from '@/lib/engine/instance';

// GET: Inference engine status and available models
export async function GET() {
  const status = inferenceEngine.getStatus();
  const models = inferenceEngine.getAvailableModels();
  const config = inferenceEngine.getConfig();

  return NextResponse.json({
    status,
    models: models.map(m => ({
      filename: m.filename,
      sizeMB: m.sizeMB,
      detected: m.detected,
    })),
    config: {
      backend: config.backend,
      contextSize: config.contextSize,
      threads: config.threads,
      gpuLayers: config.gpuLayers,
      port: config.port,
    },
  });
}

// POST: Start/stop the inference engine, select model
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    switch (body.action) {
      case 'start': {
        const modelPath = body.modelPath;
        const result = await inferenceEngine.startServer(modelPath);
        return NextResponse.json(result);
      }

      case 'stop': {
        await inferenceEngine.stopServer();
        return NextResponse.json({ success: true, message: 'Inference engine stopped' });
      }

      case 'select': {
        const model = inferenceEngine.getAvailableModels().find(m => m.filename === body.filename);
        if (!model) {
          return NextResponse.json(
            { success: false, message: `Model not found: ${body.filename}` },
            { status: 404 }
          );
        }
        // Start with selected model
        const result = await inferenceEngine.startServer(model.path);
        return NextResponse.json(result);
      }

      case 'discover': {
        const models = inferenceEngine.discoverModels();
        return NextResponse.json({
          success: true,
          models: models.map(m => ({
            filename: m.filename,
            sizeMB: m.sizeMB,
            detected: m.detected,
          })),
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action. Use: start, stop, select, discover' }, { status: 400 });
    }
  } catch (error) {
    console.error('Inference API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
