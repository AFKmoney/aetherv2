// AetherOS Engine Types — Unified AI Orchestration Platform
// Inspired by aether-engine (https://github.com/AFKmoney/aether-engine)

export type Complexity = 'simple' | 'moderate' | 'complex';

export type PipelineStage =
  | 'cache_check'
  | 'graph_retrieval'
  | 'context_compression'
  | 'complexity_analysis'
  | 'decomposition'
  | 'solve'
  | 'synthesis'
  | 'atd_verification'
  | 'distillation'
  | 'speculative_prefetch';

export interface PipelineStageResult {
  stage: PipelineStage;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  durationMs: number;
  detail: string;
  metadata?: Record<string, unknown>;
}

export interface PipelineResult {
  query: string;
  complexity: Complexity;
  stages: PipelineStageResult[];
  response: string;
  model: string;
  cacheHit: boolean;
  atdPassed: boolean;
  totalLatencyMs: number;
  subQuestions?: SubQuestion[];
}

export interface SubQuestion {
  id: string;
  question: string;
  answer: string;
  dependencies: string[];
}

export interface MemoryNode {
  id: string;
  text: string;
  category: 'fact' | 'lesson' | 'plan' | 'goal' | 'intention' | 'log' | 'code';
  score: number;
  vector: Map<string, number>; // TF-IDF sparse vector
  createdAt: number;
  updatedAt: number;
}

export interface MemoryEdge {
  fromId: string;
  toId: string;
  weight: number;
  label: string;
}

export interface ScoredNode {
  node: MemoryNode;
  score: number;
}

export interface GraphAddRequest {
  id?: string;
  text: string;
  category?: MemoryNode['category'];
}

export interface AgentToolCall {
  tool: string;
  params: Record<string, unknown>;
}

export interface AgentRunRequest {
  goal: string;
  context?: Record<string, unknown>;
  maxIterations?: number;
}

export interface AgentRunResult {
  goal: string;
  completed: boolean;
  iterations: number;
  toolCalls: AgentToolCall[];
  finalResponse: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  pipelineStage?: PipelineStage;
  model?: string;
  tokens?: number;
  latencyMs?: number;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  stream?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  type: 'small' | 'medium' | 'large';
  capabilities: string[];
  costPerToken: number;
}

export interface ATDResult {
  validated: boolean;
  likelihood: number;
  entropy: number;
  collisionDelta: number;
  recommendation: 'Accept' | 'RetryWithLowerTemperature' | 'RetryWithRephrasedPrompt' | 'FallBackToSimpleShot';
}

export interface DistillationPattern {
  id: string;
  queryHash: string;
  queryText: string;
  pattern: SubQuestion[];
  useCount: number;
  successRate: number;
}

export interface HCMState {
  dimension: number;
  pairCount: number;
  interference: number;
  memoryUsageBytes: number;
}

export interface SystemStats {
  totalRequests: number;
  cacheHits: number;
  cacheHitRate: number;
  simpleCount: number;
  moderateCount: number;
  complexCount: number;
  atdPassRate: number;
  avgLatencyMs: number;
  distillationHits: number;
  graphNodeCount: number;
  graphEdgeCount: number;
  hcmState: HCMState;
  activeModel: string;
  uptime: number;
}
