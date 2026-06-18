// AetherOS — Singleton Pipeline Instance
// Shared across all API routes

import { AetherPipeline } from '@/lib/engine/pipeline';

// Simulated LLM call for demo — in production this would call z-ai-web-dev-sdk
async function simulatedLlmCall(prompt: string, systemPrompt?: string, temperature?: number): Promise<string> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

  const temp = temperature || 0.7;

  // Smart simulation that generates contextually relevant responses
  const lower = prompt.toLowerCase();

  if (lower.includes('think step') || lower.includes('reasoning')) {
    return generateThinkingResponse(prompt);
  }

  if (lower.includes('sub-question') || lower.includes('focus only')) {
    return generateSubAnswer(prompt);
  }

  if (lower.includes('compare') || lower.includes('contrast')) {
    return generateComparisonResponse(prompt);
  }

  return generateGeneralResponse(prompt, systemPrompt);
}

function generateThinkingResponse(prompt: string): string {
  const lines = prompt.split('\n').filter(l => l.trim().length > 20);
  const query = lines[lines.length - 1] || '';

  return `Let me reason through this step by step:

1. First, I need to understand the core question: ${query.substring(0, 100)}
2. The key factors to consider are the context, constraints, and desired outcome.
3. Breaking this down into components helps identify the most important aspects.

ANSWER: Based on my analysis, here is my reasoned response addressing the key elements of the question while considering the context provided.`;
}

function generateSubAnswer(prompt: string): string {
  const lines = prompt.filter ? prompt.split('\n').filter(l => l.includes('?') || l.includes('Now answer')) : [];
  const question = lines[lines.length - 1] || 'this sub-question';

  return `Regarding ${question.substring(0, 80)}: The key insight here is that focused analysis reveals the underlying structure. By isolating this specific aspect, we can provide a precise and actionable answer that contributes to the overall understanding.`;
}

function generateComparisonResponse(prompt: string): string {
  return `## Comparison Analysis

### Key Characteristics

**First Subject:**
- Core functionality and design philosophy
- Performance characteristics and trade-offs
- Ecosystem and community support

**Second Subject:**
- Alternative approach and methodology
- Different performance profile and optimization targets
- Unique strengths and limitations

### Synthesis
Both approaches have merit depending on the specific use case. The choice depends on factors like scalability requirements, development speed, and system constraints.`;
}

function generateGeneralResponse(prompt: string, systemPrompt?: string): string {
  const hasContext = systemPrompt && systemPrompt.includes('RETRIEVED MEMORY');

  const responses = [
    hasContext
      ? `Based on the retrieved memories and my analysis, here is my response:\n\nThe information from the semantic memory graph provides valuable context. Integrating this with my knowledge, I can provide a comprehensive answer that addresses the key aspects of your query while drawing on relevant past interactions and stored knowledge.\n\nThe pipeline augmentation ensures that even as a focused model, I can deliver responses that leverage the full depth of available context and reasoning strategies.`
      : `I'll address your query comprehensively.\n\nYour question touches on an important topic. Let me break this down into key points:\n\n1. **Core Concept**: The fundamental principle here involves understanding how different components interact within the system.\n\n2. **Practical Application**: In real-world scenarios, this translates to more efficient processing and better outcomes.\n\n3. **Key Insight**: The most important takeaway is that proper orchestration of resources leads to optimal results, which is exactly what the cognitive pipeline achieves.`,

    `Excellent question! Let me provide a thorough analysis.\n\nThis involves several interconnected aspects:\n\n- **Architecture**: The system is designed with modularity in mind, allowing each component to function independently while contributing to the whole.\n- **Performance**: Through the cognitive pipeline, we achieve results that exceed what individual components could deliver alone.\n- **Scalability**: The approach scales naturally because each pipeline stage handles a specific concern.\n\nThe key innovation is treating model augmentation as a pipeline problem rather than a model size problem.`,

    `Here's my analysis of your query:\n\nThe core challenge involves balancing complexity with efficiency. The AetherOS approach addresses this through:\n\n1. **Decomposition**: Breaking complex tasks into manageable sub-tasks\n2. **Verification**: Ensuring quality through dual-graph validation\n3. **Memory**: Leveraging semantic context for informed responses\n4. **Distillation**: Learning from successful patterns\n\nThis means even smaller models can produce expert-level outputs when properly scaffolded by the cognitive pipeline.`,
  ];

  // Deterministic selection based on prompt hash
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
    hash = hash & hash;
  }
  return responses[Math.abs(hash) % responses.length];
}

// Global pipeline instance
const globalForPipeline = globalThis as unknown as {
  pipeline: AetherPipeline | undefined;
};

export const pipeline =
  globalForPipeline.pipeline ??
  new AetherPipeline(simulatedLlmCall);

if (process.env.NODE_ENV !== 'production') globalForPipeline.pipeline = pipeline;
