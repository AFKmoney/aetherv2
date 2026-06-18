// AetherOS Agent Run API — Autonomous agentic loop
// Perceive → Think → Act → Execute → Observe → Repeat

import { NextRequest, NextResponse } from 'next/server';
import { pipeline } from '@/lib/engine/instance';
import type { AgentRunRequest } from '@/lib/engine/types';

// The 12 agent tools from aether-engine
const AGENT_TOOLS = [
  { name: 'file_read', description: 'Read file contents', params: ['path'] },
  { name: 'file_write', description: 'Write file (create parents)', params: ['path', 'content'] },
  { name: 'file_list', description: 'List directory entries', params: ['path'] },
  { name: 'file_delete', description: 'Delete file/dir recursively', params: ['path'] },
  { name: 'exec', description: 'Run shell command', params: ['command'] },
  { name: 'window_open', description: 'Open app window', params: ['app', 'title'] },
  { name: 'window_close', description: 'Close window by id', params: ['id'] },
  { name: 'memory_add', description: 'Add memory to semantic graph', params: ['text', 'category'] },
  { name: 'memory_search', description: 'Search graph by cosine similarity', params: ['query', 'topN'] },
  { name: 'web_search', description: 'Search the public web', params: ['query'] },
  { name: 'plan_create', description: 'Create multi-step plan', params: ['steps'] },
  { name: 'plan_update', description: 'Mark plan step as done', params: ['stepId', 'status'] },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const agentRequest: AgentRunRequest = {
      goal: body.goal || '',
      context: body.context || {},
      maxIterations: Math.min(Math.max(body.maxIterations || 10, 1), 50),
    };

    if (!agentRequest.goal) {
      return NextResponse.json(
        { error: 'Goal is required' },
        { status: 400 }
      );
    }

    // Build agent system prompt
    const toolDescriptions = AGENT_TOOLS.map(t =>
      `### ${t.name}\n${t.description}\nParameters: ${t.params.join(', ')}`
    ).join('\n');

    const systemPrompt = `# AETHER AUTONOMOUS AGENT — AetherOS Cognitive Core
You are the autonomous agent core of AetherOS, a self-evolving AI orchestration system.
You perceive the current state, reason about what to do, and act through tools.

## Goal protocol
To call a tool, emit a JSON object with "tool" and "params" fields.
When goal is achieved, emit TASK_COMPLETE.

## Available tools
${toolDescriptions}

## Current context
${JSON.stringify(agentRequest.context, null, 2)}

## Operating principles
- Act deliberately: one logical action per iteration
- Verify before trusting: use memory_search before destructive actions
- Persist lessons: use memory_add for anything worth remembering
- Decompose complexity: use plan_create for goals with 2+ steps
- Observe carefully: read tool results before deciding next action
- Stop only when done: emit TASK_COMPLETE when goal is fully achieved`;

    // Simulate agent loop
    const iterations = [];
    let completed = false;
    let currentGoal = agentRequest.goal;
    const toolCalls: Array<{ tool: string; params: Record<string, unknown> }> = [];

    // Run agent iterations
    for (let i = 0; i < Math.min(agentRequest.maxIterations, 4); i++) {
      const agentPrompt = `Iteration ${i + 1}. Goal: ${currentGoal}. What should I do next?`;

      const result = await pipeline.process({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: agentPrompt },
        ],
        temperature: 0.5,
      });

      const response = result.response;

      // Parse tool calls from response
      const parsedToolCall = parseToolCall(response);

      iterations.push({
        iteration: i + 1,
        thinking: response,
        toolCall: parsedToolCall,
        pipelineStages: result.stages,
      });

      if (parsedToolCall) {
        toolCalls.push(parsedToolCall);

        // Execute tool (simulated)
        const toolResult = executeTool(parsedToolCall);

        // Add memory for important actions
        if (parsedToolCall.tool === 'memory_add' && parsedToolCall.params.text) {
          pipeline.getGraph().add({
            text: parsedToolCall.params.text as string,
            category: (parsedToolCall.params.category as any) || 'fact',
          });
        }

        // Check if goal is complete
        if (response.includes('TASK_COMPLETE') || i >= agentRequest.maxIterations - 1) {
          completed = true;
        }
      } else {
        // No parseable tool call — agent might be done
        if (response.includes('TASK_COMPLETE')) {
          completed = true;
        }
      }

      if (completed) break;
    }

    return NextResponse.json({
      goal: agentRequest.goal,
      completed,
      iterations: iterations.length,
      iterationsDetail: iterations,
      toolCalls,
      finalResponse: iterations[iterations.length - 1]?.thinking || 'No response',
    });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// Robust tool-call parser (handles multiple formats from small models)
function parseToolCall(text: string): { tool: string; params: Record<string, unknown> } | null {
  // Try to find JSON objects in the text
  const jsonPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  const matches = text.match(jsonPattern);

  if (!matches) return null;

  for (const match of matches) {
    try {
      const obj = JSON.parse(match);

      // Format 1: { tool: "...", params: {...} }
      if (obj.tool || obj.name || obj.tool_name) {
        return {
          tool: obj.tool || obj.name || obj.tool_name,
          params: obj.params || obj.arguments || obj.args || {},
        };
      }

      // Format 2: { function: { name: "...", arguments: "..." } }
      if (obj.function?.name) {
        return {
          tool: obj.function.name,
          params: typeof obj.function.arguments === 'string'
            ? JSON.parse(obj.function.arguments)
            : obj.function.arguments || {},
        };
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return null;
}

// Simulated tool executor
function executeTool(call: { tool: string; params: Record<string, unknown> }): string {
  switch (call.tool) {
    case 'file_read':
      return `[Simulated] Would read file: ${call.params.path}`;
    case 'file_write':
      return `[Simulated] Would write to: ${call.params.path}`;
    case 'memory_add':
      return `[Simulated] Added memory: ${String(call.params.text).substring(0, 50)}...`;
    case 'memory_search': {
      const results = pipeline.getGraph().search(String(call.params.query || ''), 3);
      return results.length > 0
        ? `Found ${results.length} memories: ${results.map(r => r.node.text.substring(0, 50)).join('; ')}`
        : 'No memories found';
    }
    default:
      return `[Simulated] Executed ${call.tool} with params: ${JSON.stringify(call.params)}`;
  }
}

// GET: List available tools
export async function GET() {
  return NextResponse.json({ tools: AGENT_TOOLS });
}
