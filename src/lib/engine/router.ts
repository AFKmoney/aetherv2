// AetherOS Multi-Model Router
// Routes requests to the right AI model based on complexity and capability
// Supports: Super Z (z-ai-web-dev-sdk), Claude (simulated), Local Models (simulated)

import type { Complexity, ModelInfo } from './types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'aether-super-z',
    name: 'Super Z (Primary)',
    provider: 'z-ai',
    type: 'large',
    capabilities: ['reasoning', 'coding', 'analysis', 'creative', 'tools', 'web-search'],
    costPerToken: 0.003,
  },
  {
    id: 'aether-claude',
    name: 'Claude (Partner)',
    provider: 'anthropic',
    type: 'large',
    capabilities: ['reasoning', 'coding', 'analysis', 'creative', 'long-context'],
    costPerToken: 0.003,
  },
  {
    id: 'aether-small-fast',
    name: 'Nano Agent (1.2B)',
    provider: 'local-gguf',
    type: 'small',
    capabilities: ['simple-qa', 'summarization', 'classification'],
    costPerToken: 0.0,
  },
  {
    id: 'aether-medium',
    name: 'Medius Agent (7B)',
    provider: 'local-gguf',
    type: 'medium',
    capabilities: ['reasoning', 'coding-basic', 'analysis-basic', 'summarization'],
    costPerToken: 0.0,
  },
  {
    id: 'aether-cache',
    name: 'Cache Hit',
    provider: 'aether',
    type: 'small',
    capabilities: ['cached-responses'],
    costPerToken: 0.0,
  },
  {
    id: 'aether-pipeline',
    name: 'Pipeline Synthesized',
    provider: 'aether',
    type: 'medium',
    capabilities: ['decomposed-reasoning', 'synthesis'],
    costPerToken: 0.0,
  },
];

// Route based on complexity — the "super agent outfit" strategy
export function routeModel(complexity: Complexity, cacheHit: boolean): ModelInfo {
  if (cacheHit) {
    return AVAILABLE_MODELS.find(m => m.id === 'aether-cache')!;
  }

  switch (complexity) {
    case 'simple':
      // Simple queries go to the small model — it's fast and free
      // The "outfit": pipeline augmentation makes the small model sufficient
      return AVAILABLE_MODELS.find(m => m.id === 'aether-small-fast')!;
    case 'moderate':
      // Moderate queries: medium model with think-step augmentation
      return AVAILABLE_MODELS.find(m => m.id === 'aether-medium')!;
    case 'complex':
      // Complex queries: full pipeline with decomposition
      // The pipeline itself IS the intelligence — the model just needs to follow
      return AVAILABLE_MODELS.find(m => m.id === 'aether-super-z')!;
  }
}

// Determine which model should handle each sub-question
export function routeSubQuestion(subQuestionIndex: number, totalSubQuestions: number): ModelInfo {
  // First and last sub-questions are more critical — use the better model
  if (subQuestionIndex === 0 || subQuestionIndex === totalSubQuestions - 1) {
    return AVAILABLE_MODELS.find(m => m.id === 'aether-medium')!;
  }
  // Middle sub-questions can use the small model — simpler focused tasks
  return AVAILABLE_MODELS.find(m => m.id === 'aether-small-fast')!;
}
