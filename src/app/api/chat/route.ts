// AetherOS Chat Completions API — OpenAI-compatible endpoint
// Routes through the 10-stage cognitive pipeline

import { NextRequest, NextResponse } from 'next/server';
import { pipeline } from '@/lib/engine/instance';
import type { ChatRequest } from '@/lib/engine/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const chatRequest: ChatRequest = {
      messages: body.messages || [],
      model: body.model || 'aether-pipeline',
      temperature: body.temperature || 0.7,
      stream: body.stream || false,
    };

    if (chatRequest.messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array cannot be empty' },
        { status: 400 }
      );
    }

    const result = await pipeline.process(chatRequest);

    // Return in OpenAI-compatible format
    const response = {
      id: `aether-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.response,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: result.query.split(/\s+/).length,
        completion_tokens: result.response.split(/\s+/).length,
        total_tokens: result.query.split(/\s+/).length + result.response.split(/\s+/).length,
      },
      // AetherOS extensions
      aether: {
        complexity: result.complexity,
        cacheHit: result.cacheHit,
        atdPassed: result.atdPassed,
        totalLatencyMs: result.totalLatencyMs,
        pipelineStages: result.stages,
        subQuestions: result.subQuestions,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
