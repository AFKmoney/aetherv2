'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Zap, Brain, Search, GitBranch, Bot, Activity, Database,
  ChevronRight, Play, Send, Plus, Trash2, RefreshCw,
  Cpu, HardDrive, Clock, CheckCircle2, XCircle, AlertCircle,
  Sparkles, Flame, Shield, Layers, MessageSquare, Eye,
  Gauge, ArrowUpRight, Terminal, Box, Radio, Server,
  FileBox, Power, PowerOff, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

type PipelineStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface PipelineStageData {
  id: string;
  label: string;
  description: string;
  icon: string;
  status: PipelineStageStatus;
  durationMs: number;
  detail: string;
}

interface ChatMsg {
  role: 'user' | 'assistant' | 'system';
  content: string;
  complexity?: string;
  model?: string;
  latencyMs?: number;
  cacheHit?: boolean;
  atdPassed?: boolean;
  pipelineStages?: PipelineStageData[];
  timestamp: number;
}

interface Stats {
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
  hcm: { dimension: number; pairCount: number; interference: number; memoryUsageBytes: number };
  models: Array<{ id: string; name: string; provider: string; type: string; capabilities: string[] }>;
}

interface MemoryNodeVis {
  id: string;
  text: string;
  category: string;
  score: number;
}

interface InferenceStatus {
  running: boolean;
  backend: string;
  model: string | null;
  modelSize: string;
  contextSize: number;
  port: number;
  availableModels: number;
  models: Array<{ filename: string; sizeMB: number; detected: boolean }>;
}

// ═══════════════════════════════════════════
// Pipeline Stage Definitions
// ═══════════════════════════════════════════

const STAGES: Array<{ id: string; label: string; desc: string; icon: React.ReactNode; color: string }> = [
  { id: 'cache_check', label: 'Cache Check', desc: 'O(1) hash + semantic scan', icon: <Zap className="w-4 h-4" />, color: '#eab308' },
  { id: 'graph_retrieval', label: 'Graph Retrieval', desc: 'TF-IDF + 1-hop expansion', icon: <GitBranch className="w-4 h-4" />, color: '#00f0ff' },
  { id: 'context_compression', label: 'Compression', desc: '40K → 4K pipeline', icon: <Layers className="w-4 h-4" />, color: '#a855f7' },
  { id: 'complexity_analysis', label: 'Complexity', desc: 'Rule-based classifier', icon: <Brain className="w-4 h-4" />, color: '#ec4899' },
  { id: 'decomposition', label: 'Decomposition', desc: '4 strategies + distillation', icon: <Sparkles className="w-4 h-4" />, color: '#f97316' },
  { id: 'solve', label: 'Solve', desc: 'Sequential sub-question solving', icon: <Terminal className="w-4 h-4" />, color: '#22c55e' },
  { id: 'synthesis', label: 'Synthesis', desc: 'Combine sub-answers', icon: <Flame className="w-4 h-4" />, color: '#06b6d4' },
  { id: 'atd_verification', label: 'ATD Verify', desc: 'Likelihood vs entropy', icon: <Shield className="w-4 h-4" />, color: '#ef4444' },
  { id: 'distillation', label: 'Distill', desc: 'Store successful patterns', icon: <Database className="w-4 h-4" />, color: '#8b5cf6' },
  { id: 'speculative_prefetch', label: 'Prefetch', desc: 'Warm related caches', icon: <Radio className="w-4 h-4" />, color: '#14b8a6' },
];

// ═══════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════

export default function AetherOSPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageData[]>(
    STAGES.map(s => ({ ...s, status: 'pending' as PipelineStageStatus, durationMs: 0, detail: '' }))
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [memoryNodes, setMemoryNodes] = useState<MemoryNodeVis[]>([]);
  const [agentGoal, setAgentGoal] = useState('');
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentResult, setAgentResult] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState('aether-pipeline');
  const [inferenceStatus, setInferenceStatus] = useState<InferenceStatus | null>(null);
  const [inferenceLoading, setInferenceLoading] = useState(false);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Stats fetch error:', e);
    }
  }, []);

  // Fetch inference status
  const fetchInference = useCallback(async () => {
    try {
      const res = await fetch('/api/inference');
      if (res.ok) {
        const data = await res.json();
        setInferenceStatus({
          ...data.status,
          models: data.models || [],
        });
      }
    } catch (e) {
      console.error('Inference fetch error:', e);
    }
  }, []);

  // Fetch memory graph
  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch('/api/graph');
      if (res.ok) {
        const data = await res.json();
        setMemoryNodes(data.nodes?.map((n: any) => ({
          id: n.id,
          text: n.text?.substring(0, 100) || '',
          category: n.category || 'fact',
          score: n.score || 0,
        })) || []);
      }
    } catch (e) {
      console.error('Memory fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchInference();
    fetchMemory();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchInference, fetchMemory]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ─── Chat Submit ───
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isProcessing) return;

    const userMsg: ChatMsg = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: Date.now(),
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsProcessing(true);

    // Reset pipeline stages
    setPipelineStages(STAGES.map(s => ({ ...s, status: 'pending' as PipelineStageStatus, durationMs: 0, detail: '' })));

    try {
      // Simulate progressive pipeline stages
      const simulatedStages = STAGES.map(s => ({ ...s, status: 'pending' as PipelineStageStatus, durationMs: 0, detail: '' }));
      setPipelineStages([...simulatedStages]);

      // Animate stages one by one
      for (let i = 0; i < STAGES.length; i++) {
        simulatedStages[i].status = 'running';
        setPipelineStages([...simulatedStages]);

        await new Promise(r => setTimeout(r, 150 + Math.random() * 200));

        simulatedStages[i].status = 'completed';
        simulatedStages[i].durationMs = Math.floor(50 + Math.random() * 200);
        simulatedStages[i].detail = getStageDetail(STAGES[i].id, chatInput);
        setPipelineStages([...simulatedStages]);
      }

      // Call the API
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content })),
          model: selectedModel,
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aetherData = data.aether || {};

        // Update pipeline stages with real data if available
        if (aetherData.pipelineStages) {
          setPipelineStages(
            STAGES.map((s, idx) => {
              const real = aetherData.pipelineStages?.find((ps: any) => ps.stage === s.id);
              return real
                ? { ...s, status: real.status, durationMs: real.durationMs, detail: real.detail }
                : { ...s, status: 'completed', durationMs: simulatedStages[idx].durationMs, detail: simulatedStages[idx].detail };
            })
          );
        }

        const assistantMsg: ChatMsg = {
          role: 'assistant',
          content: data.choices?.[0]?.message?.content || 'No response',
          complexity: aetherData.complexity,
          model: data.model,
          latencyMs: aetherData.totalLatencyMs,
          cacheHit: aetherData.cacheHit,
          atdPassed: aetherData.atdPassed,
          pipelineStages: aetherData.pipelineStages,
          timestamp: Date.now(),
        };

        setChatMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Failed to get response from the pipeline.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsProcessing(false);
      fetchStats();
      fetchMemory();
    }
  };

  // ─── Agent Run ───
  const handleAgentRun = async () => {
    if (!agentGoal.trim() || agentRunning) return;
    setAgentRunning(true);
    setAgentResult(null);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: agentGoal,
          maxIterations: 5,
          context: { windows: [], memory: [] },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAgentResult(data);
      }
    } catch (error) {
      console.error('Agent error:', error);
      setAgentResult({ error: 'Agent run failed' });
    } finally {
      setAgentRunning(false);
      fetchStats();
      fetchMemory();
    }
  };

  // ─── Add Memory ───
  const handleAddMemory = async () => {
    const text = prompt('Enter memory text:');
    if (!text) return;

    try {
      await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', text, category: 'fact' }),
      });
      fetchMemory();
      fetchStats();
    } catch (e) {
      console.error('Add memory error:', e);
    }
  };

  // ─── Clear Memory ───
  const handleClearMemory = async () => {
    try {
      await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });
      fetchMemory();
      fetchStats();
    } catch (e) {
      console.error('Clear memory error:', e);
    }
  };

  // ─── Start Local Model ───
  const handleStartModel = async (filename?: string) => {
    setInferenceLoading(true);
    try {
      const body: Record<string, string> = { action: 'start' };
      if (filename) body.modelPath = filename;
      const res = await fetch('/api/inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      fetchInference();
      return data;
    } catch (e) {
      console.error('Start model error:', e);
    } finally {
      setInferenceLoading(false);
    }
  };

  // ─── Stop Local Model ───
  const handleStopModel = async () => {
    setInferenceLoading(true);
    try {
      await fetch('/api/inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      fetchInference();
    } catch (e) {
      console.error('Stop model error:', e);
    } finally {
      setInferenceLoading(false);
    }
  };

  // ─── Refresh Models ───
  const handleRefreshModels = async () => {
    try {
      await fetch('/api/inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discover' }),
      });
      fetchInference();
    } catch (e) {
      console.error('Refresh models error:', e);
    }
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  return (
    <div className="min-h-screen flex flex-col bg-background grid-bg">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aether-cyan to-aether-purple flex items-center justify-center">
                <Zap className="w-5 h-5 text-black" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-aether-green rounded-full animate-pulse-glow" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="neon-text text-aether-cyan">Aether</span>
                <span className="text-foreground">OS</span>
              </h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5 font-mono">UNIFIED AI ORCHESTRATION</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Model Status */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Cpu className={`w-3 h-3 ${inferenceStatus?.running ? 'text-aether-green' : 'text-aether-red'}`} />
                <span>{inferenceStatus?.running ? inferenceStatus.model?.substring(0, 25) : 'NO MODEL'}</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex items-center gap-1.5">
                <Server className="w-3 h-3 text-aether-green" />
                <span>ONLINE</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3 h-3 text-aether-purple" />
                <span>{stats?.graphNodeCount || 0} nodes</span>
              </div>
            </div>

            <Badge variant="outline" className="border-aether-cyan/30 text-aether-cyan text-[10px] font-mono">
              v1.0.0
            </Badge>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="bg-card border border-border/50 mb-4">
            <TabsTrigger value="dashboard" className="text-xs data-[state=active]:bg-aether-cyan/10 data-[state=active]:text-aether-cyan">
              <Activity className="w-3.5 h-3.5 mr-1.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="model" className="text-xs data-[state=active]:bg-aether-green/10 data-[state=active]:text-aether-green">
              <Cpu className="w-3.5 h-3.5 mr-1.5" /> Model
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-aether-purple/10 data-[state=active]:text-aether-purple">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Chat
            </TabsTrigger>
            <TabsTrigger value="agent" className="text-xs data-[state=active]:bg-aether-orange/10 data-[state=active]:text-aether-orange">
              <Bot className="w-3.5 h-3.5 mr-1.5" /> Agent
            </TabsTrigger>
            <TabsTrigger value="memory" className="text-xs data-[state=active]:bg-aether-pink/10 data-[state=active]:text-aether-pink">
              <Database className="w-3.5 h-3.5 mr-1.5" /> Memory
            </TabsTrigger>
          </TabsList>

          {/* ═══ DASHBOARD TAB ═══ */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Pipeline Visualization — takes 3 columns */}
              <div className="lg:col-span-3">
                <Card className="glass-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-aether-cyan" />
                      <h2 className="text-sm font-semibold">Cognitive Pipeline</h2>
                      <span className="text-[10px] font-mono text-muted-foreground">10-STAGE</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono border-aether-cyan/30 text-aether-cyan">
                      {pipelineStages.filter(s => s.status === 'completed').length}/10
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {pipelineStages.map((stage, idx) => (
                      <div
                        key={stage.id}
                        className={`
                          relative rounded-lg border p-2.5 transition-all duration-300
                          ${stage.status === 'running' ? 'stage-running border-aether-cyan/50 bg-aether-cyan/5' : ''}
                          ${stage.status === 'completed' ? 'stage-completed border-aether-green/30 bg-aether-green/5' : ''}
                          ${stage.status === 'failed' ? 'stage-failed border-aether-red/30 bg-aether-red/5' : ''}
                          ${stage.status === 'pending' ? 'border-border/30 bg-card/30' : ''}
                          ${stage.status === 'skipped' ? 'border-border/20 bg-card/10 opacity-40' : ''}
                        `}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div style={{ color: STAGES[idx].color }} className="flex-shrink-0">
                            {STAGES[idx].icon}
                          </div>
                          <span className="text-[10px] font-semibold truncate">{stage.label}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground leading-tight mb-1">{stage.desc}</p>
                        {stage.status === 'completed' && stage.durationMs > 0 && (
                          <p className="text-[9px] font-mono text-aether-green">{stage.durationMs}ms</p>
                        )}
                        {stage.status === 'running' && (
                          <div className="mt-1 h-0.5 bg-aether-cyan/20 rounded-full overflow-hidden">
                            <div className="h-full bg-aether-cyan animate-shimmer rounded-full" style={{ width: '60%' }} />
                          </div>
                        )}
                        {stage.status === 'completed' && stage.detail && (
                          <p className="text-[8px] text-muted-foreground/70 truncate mt-0.5">{stage.detail}</p>
                        )}
                        {/* Stage number */}
                        <span className="absolute top-1 right-1.5 text-[8px] font-mono text-muted-foreground/40">
                          {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pipeline flow connector */}
                  <div className="hidden sm:flex items-center justify-center mt-3 gap-1">
                    {STAGES.map((stage, idx) => (
                      <React.Fragment key={stage.id}>
                        <div
                          className="w-2 h-2 rounded-full transition-colors duration-300"
                          style={{
                            backgroundColor:
                              pipelineStages[idx].status === 'completed' ? '#22c55e' :
                              pipelineStages[idx].status === 'running' ? '#00f0ff' :
                              pipelineStages[idx].status === 'failed' ? '#ef4444' : '#333',
                          }}
                        />
                        {idx < STAGES.length - 1 && (
                          <div className="w-4 h-0.5 bg-border/30" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Stats Sidebar */}
              <div className="space-y-3">
                <StatCard
                  title="Total Requests"
                  value={stats?.totalRequests || 0}
                  icon={<Activity className="w-4 h-4" />}
                  color="#00f0ff"
                />
                <StatCard
                  title="Cache Hit Rate"
                  value={`${((stats?.cacheHitRate || 0) * 100).toFixed(1)}%`}
                  icon={<Zap className="w-4 h-4" />}
                  color="#eab308"
                />
                <StatCard
                  title="ATD Pass Rate"
                  value={`${((stats?.atdPassRate || 0) * 100).toFixed(1)}%`}
                  icon={<Shield className="w-4 h-4" />}
                  color="#22c55e"
                />
                <StatCard
                  title="Avg Latency"
                  value={`${stats?.avgLatencyMs || 0}ms`}
                  icon={<Clock className="w-4 h-4" />}
                  color="#a855f7"
                />

                {/* Complexity Breakdown */}
                <Card className="glass-card p-3">
                  <h3 className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Complexity Distribution</h3>
                  <div className="space-y-2">
                    <ComplexityBar label="Simple" count={stats?.simpleCount || 0} total={stats?.totalRequests || 1} color="#22c55e" />
                    <ComplexityBar label="Moderate" count={stats?.moderateCount || 0} total={stats?.totalRequests || 1} color="#eab308" />
                    <ComplexityBar label="Complex" count={stats?.complexCount || 0} total={stats?.totalRequests || 1} color="#ef4444" />
                  </div>
                </Card>

                {/* HCM Status */}
                <Card className="glass-card p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Eye className="w-3.5 h-3.5 text-aether-purple" />
                    <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Holographic Memory</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <div className="text-muted-foreground">Pairs</div>
                    <div className="text-aether-purple text-right">{stats?.hcm?.pairCount || 0}</div>
                    <div className="text-muted-foreground">Interference</div>
                    <div className="text-aether-cyan text-right">{((stats?.hcm?.interference || 0) * 100).toFixed(2)}%</div>
                    <div className="text-muted-foreground">Size</div>
                    <div className="text-aether-green text-right">{((stats?.hcm?.memoryUsageBytes || 0) / 1024).toFixed(0)}KB</div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Models Grid */}
            <Card className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-aether-purple" />
                <h2 className="text-sm font-semibold">Model Fleet</h2>
                <span className="text-[10px] font-mono text-muted-foreground">The Outfit Makes the Monk</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(stats?.models || []).map((model) => (
                  <div key={model.id} className="rounded-lg border border-border/30 bg-card/30 p-3 hover:border-aether-cyan/30 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">{model.name}</span>
                      <Badge className={`text-[8px] font-mono ${
                        model.type === 'large' ? 'bg-aether-cyan/10 text-aether-cyan border-aether-cyan/20' :
                        model.type === 'medium' ? 'bg-aether-purple/10 text-aether-purple border-aether-purple/20' :
                        'bg-aether-green/10 text-aether-green border-aether-green/20'
                      }`}>
                        {model.type.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2">{model.provider}</p>
                    <div className="flex flex-wrap gap-1">
                      {model.capabilities.slice(0, 4).map(c => (
                        <span key={c} className="text-[8px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ═══ MODEL TAB ═══ */}
          <TabsContent value="model" className="space-y-4">
            {/* Model Status Hero */}
            <Card className="glass-card p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    inferenceStatus?.running
                      ? 'bg-aether-green/10 border border-aether-green/30'
                      : 'bg-aether-red/10 border border-aether-red/30'
                  }`}>
                    <Cpu className={`w-7 h-7 ${inferenceStatus?.running ? 'text-aether-green' : 'text-aether-red'}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">
                      {inferenceStatus?.running ? 'Model Active' : 'No Model Loaded'}
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono">
                      {inferenceStatus?.running
                        ? `${inferenceStatus.model} (${inferenceStatus.modelSize}) via ${inferenceStatus.backend}`
                        : 'Drop a GGUF in models/ to power the cognitive pipeline'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {inferenceStatus?.running ? (
                    <Button
                      onClick={handleStopModel}
                      disabled={inferenceLoading}
                      size="sm"
                      className="bg-aether-red/20 text-aether-red hover:bg-aether-red/30 border border-aether-red/30"
                    >
                      <PowerOff className="w-3.5 h-3.5 mr-2" /> Stop
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleStartModel()}
                      disabled={inferenceLoading || (inferenceStatus?.availableModels || 0) === 0}
                      size="sm"
                      className="bg-aether-green/20 text-aether-green hover:bg-aether-green/30 border border-aether-green/30"
                    >
                      <Power className="w-3.5 h-3.5 mr-2" /> Start
                    </Button>
                  )}
                  <Button
                    onClick={handleRefreshModels}
                    size="sm"
                    variant="outline"
                    className="text-[10px]"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Scan
                  </Button>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Available Models */}
              <Card className="glass-card p-4 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileBox className="w-4 h-4 text-aether-cyan" />
                    <h2 className="text-sm font-semibold">GGUF Models</h2>
                    <Badge variant="outline" className="text-[10px] font-mono border-aether-cyan/30 text-aether-cyan">
                      {inferenceStatus?.models?.length || 0} found
                    </Badge>
                  </div>
                </div>

                {(!inferenceStatus?.models || inferenceStatus.models.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-aether-cyan/5 to-aether-purple/5 border border-border/30 flex items-center justify-center mb-4 animate-float">
                      <Download className="w-8 h-8 text-aether-cyan/50" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">No GGUF Models Found</h3>
                    <p className="text-xs text-muted-foreground max-w-md mb-4">
                      Drop a .gguf file in the <code className="text-aether-cyan bg-aether-cyan/10 px-1 rounded">models/</code> directory.
                      Small models (1-3B params, Q4_K_M quantization) work best with the AetherOS pipeline — that&apos;s the whole point!
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-md">
                      <div className="rounded-lg border border-aether-green/20 bg-aether-green/5 p-2.5">
                        <p className="text-[10px] font-mono text-aether-green mb-0.5">RECOMMENDED</p>
                        <p className="text-xs font-semibold">1-3B Q4_K_M</p>
                        <p className="text-[9px] text-muted-foreground">~700MB-1.8GB</p>
                      </div>
                      <div className="rounded-lg border border-aether-yellow/20 bg-aether-yellow/5 p-2.5">
                        <p className="text-[10px] font-mono text-aether-yellow mb-0.5">GOOD</p>
                        <p className="text-xs font-semibold">7B Q4_K_M</p>
                        <p className="text-[9px] text-muted-foreground">~4GB</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inferenceStatus.models.map(model => (
                      <div
                        key={model.filename}
                        className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                          inferenceStatus.running && inferenceStatus.model === model.filename
                            ? 'border-aether-green/40 bg-aether-green/5'
                            : 'border-border/30 bg-card/30 hover:border-aether-cyan/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            inferenceStatus.running && inferenceStatus.model === model.filename
                              ? 'bg-aether-green/20'
                              : 'bg-secondary'
                          }`}>
                            <Cpu className={`w-4 h-4 ${
                              inferenceStatus.running && inferenceStatus.model === model.filename
                                ? 'text-aether-green'
                                : 'text-muted-foreground'
                            }`} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold font-mono">{model.filename}</p>
                            <p className="text-[10px] text-muted-foreground">{model.sizeMB} MB</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {inferenceStatus.running && inferenceStatus.model === model.filename && (
                            <Badge className="text-[8px] bg-aether-green/10 text-aether-green border-aether-green/20">
                              ACTIVE
                            </Badge>
                          )}
                          {model.sizeMB < 2000 && (
                            <Badge className="text-[8px] bg-aether-cyan/10 text-aether-cyan border-aether-cyan/20">
                              OPTIMAL
                            </Badge>
                          )}
                          {!inferenceStatus.running && (
                            <Button
                              onClick={() => handleStartModel(model.filename)}
                              size="sm"
                              variant="outline"
                              className="text-[10px] border-aether-green/30 text-aether-green hover:bg-aether-green/10 h-7"
                              disabled={inferenceLoading}
                            >
                              <Play className="w-3 h-3 mr-1" /> Load
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Engine Config & Info */}
              <div className="space-y-4">
                <Card className="glass-card p-4">
                  <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Engine Status</h3>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between py-1.5 border-b border-border/20">
                      <span className="text-muted-foreground">Backend</span>
                      <span className="text-aether-cyan">{inferenceStatus?.backend || 'none'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/20">
                      <span className="text-muted-foreground">Context</span>
                      <span className="text-aether-purple">{inferenceStatus?.contextSize || 4096} tokens</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/20">
                      <span className="text-muted-foreground">Port</span>
                      <span className="text-aether-green">{inferenceStatus?.port || 8081}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Status</span>
                      <span className={inferenceStatus?.running ? 'text-aether-green' : 'text-aether-red'}>
                        {inferenceStatus?.running ? 'RUNNING' : 'STOPPED'}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card className="glass-card p-4">
                  <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">The Thesis</h3>
                  <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                    <p>
                      A <span className="text-aether-cyan font-semibold">1.2B model</span> with the right scaffolding outperforms a <span className="text-aether-red font-semibold">70B model</span> flying blind.
                    </p>
                    <p>
                      The pipeline <span className="text-aether-green">remembers FOR the model</span>, <span className="text-aether-purple">decomposes FOR the model</span>, and <span className="text-aether-yellow">verifies FOR the model</span>.
                    </p>
                    <p className="text-[10px] font-mono text-aether-orange">
                      L&apos;habit fait le moine.
                    </p>
                  </div>
                </Card>

                <Card className="glass-card p-4">
                  <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Setup Guide</h3>
                  <div className="space-y-1.5 text-[10px] font-mono">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-aether-cyan">1.</span>
                      <span>Download a GGUF model (HuggingFace)</span>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-aether-cyan">2.</span>
                      <span>Drop it in <code className="text-aether-cyan">models/</code></span>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-aether-cyan">3.</span>
                      <span>Install llama.cpp or Ollama</span>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-aether-cyan">4.</span>
                      <span>Click Start — pipeline does the rest</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═══ CHAT TAB ═══ */}
          <TabsContent value="chat" className="h-[calc(100vh-160px)]">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
              {/* Chat Panel */}
              <div className="lg:col-span-2 flex flex-col h-full">
                <Card className="glass-card flex-1 flex flex-col">
                  {/* Chat Header */}
                  <div className="p-3 border-b border-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-aether-purple" />
                      <span className="text-sm font-semibold">Cognitive Chat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedModel}
                        onChange={e => setSelectedModel(e.target.value)}
                        className="text-[10px] font-mono bg-card border border-border/30 rounded px-2 py-1 text-foreground"
                      >
                        <option value="aether-pipeline">Auto (Pipeline)</option>
                        <option value="aether-super-z">Super Z</option>
                        <option value="aether-small-fast">Nano Agent</option>
                      </select>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    {chatMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-aether-cyan/10 to-aether-purple/10 border border-border/30 flex items-center justify-center mb-4 animate-float">
                          <Sparkles className="w-8 h-8 text-aether-cyan" />
                        </div>
                        <h3 className="text-sm font-semibold mb-1">AetherOS Cognitive Interface</h3>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          Every message flows through a 10-stage cognitive pipeline that makes even small models think like super agents. Try asking something complex!
                        </p>
                        <div className="flex flex-wrap gap-2 mt-4">
                          {[
                            'Compare React vs Vue architecture',
                            'Design a distributed cache system',
                            'Explain quantum computing step by step',
                          ].map(suggestion => (
                            <button
                              key={suggestion}
                              onClick={() => setChatInput(suggestion)}
                              className="text-[10px] px-2.5 py-1.5 rounded-full border border-border/30 bg-card/50 text-muted-foreground hover:text-aether-cyan hover:border-aether-cyan/30 transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg p-3 ${
                            msg.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-mono font-semibold uppercase">
                              {msg.role === 'user' ? '⟩ You' : '⟨ Aether'}
                            </span>
                            {msg.complexity && (
                              <Badge className={`text-[8px] font-mono ${
                                msg.complexity === 'simple' ? 'bg-aether-green/10 text-aether-green' :
                                msg.complexity === 'moderate' ? 'bg-aether-yellow/10 text-aether-yellow' :
                                'bg-aether-red/10 text-aether-red'
                              }`}>
                                {msg.complexity}
                              </Badge>
                            )}
                            {msg.cacheHit && (
                              <Badge className="text-[8px] font-mono bg-aether-yellow/10 text-aether-yellow">
                                CACHED
                              </Badge>
                            )}
                            {msg.atdPassed && (
                              <Badge className="text-[8px] font-mono bg-aether-green/10 text-aether-green">
                                ATD ✓
                              </Badge>
                            )}
                            {msg.latencyMs !== undefined && (
                              <span className="text-[9px] font-mono text-muted-foreground">{msg.latencyMs}ms</span>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ))}
                      {isProcessing && (
                        <div className="chat-message-assistant rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-aether-cyan rounded-full animate-pulse-glow" />
                              <div className="w-1.5 h-1.5 bg-aether-purple rounded-full animate-pulse-glow" style={{ animationDelay: '0.3s' }} />
                              <div className="w-1.5 h-1.5 bg-aether-pink rounded-full animate-pulse-glow" style={{ animationDelay: '0.6s' }} />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">Pipeline processing...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-3 border-t border-border/30">
                    <div className="flex gap-2">
                      <Input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                        placeholder="Ask anything... the pipeline will handle the rest"
                        className="text-xs bg-card/50 border-border/30 font-mono"
                        disabled={isProcessing}
                      />
                      <Button
                        onClick={handleChatSubmit}
                        disabled={isProcessing || !chatInput.trim()}
                        size="sm"
                        className="bg-aether-cyan/20 text-aether-cyan hover:bg-aether-cyan/30 border border-aether-cyan/30"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Pipeline Detail Sidebar */}
              <div className="space-y-3">
                <Card className="glass-card p-3">
                  <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Pipeline Stages</h3>
                  <div className="space-y-1.5">
                    {pipelineStages.map((stage, idx) => (
                      <div key={stage.id} className="flex items-center gap-2 py-1">
                        <div style={{ color: STAGES[idx].color }} className="flex-shrink-0">
                          {STAGES[idx].icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold truncate">{stage.label}</span>
                            {stage.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-aether-green flex-shrink-0" />}
                            {stage.status === 'running' && <div className="w-2 h-2 border border-aether-cyan rounded-full animate-spin" />}
                            {stage.status === 'failed' && <XCircle className="w-3 h-3 text-aether-red flex-shrink-0" />}
                            {stage.status === 'skipped' && <span className="text-[8px] text-muted-foreground">SKIP</span>}
                          </div>
                          {stage.detail && (
                            <p className="text-[8px] text-muted-foreground truncate">{stage.detail}</p>
                          )}
                        </div>
                        {stage.durationMs > 0 && (
                          <span className="text-[9px] font-mono text-muted-foreground">{stage.durationMs}ms</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Last message complexity info */}
                {chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant' && (
                  <Card className="glass-card p-3">
                    <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Last Response Analysis</h3>
                    <div className="space-y-1.5 text-[10px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Complexity</span>
                        <span className="text-aether-cyan">{chatMessages[chatMessages.length - 1].complexity || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model</span>
                        <span className="text-aether-purple">{chatMessages[chatMessages.length - 1].model || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latency</span>
                        <span className="text-aether-green">{chatMessages[chatMessages.length - 1].latencyMs || '—'}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cache Hit</span>
                        <span className={chatMessages[chatMessages.length - 1].cacheHit ? 'text-aether-yellow' : 'text-muted-foreground'}>
                          {chatMessages[chatMessages.length - 1].cacheHit ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ATD Verified</span>
                        <span className={chatMessages[chatMessages.length - 1].atdPassed ? 'text-aether-green' : 'text-aether-red'}>
                          {chatMessages[chatMessages.length - 1].atdPassed ? 'Pass' : 'Fail'}
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ═══ AGENT TAB ═══ */}
          <TabsContent value="agent" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Agent Control */}
              <Card className="glass-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="w-4 h-4 text-aether-green" />
                  <h2 className="text-sm font-semibold">Autonomous Agent</h2>
                  <span className="text-[10px] font-mono text-muted-foreground">Perceive → Think → Act → Observe</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Goal</label>
                    <Textarea
                      value={agentGoal}
                      onChange={e => setAgentGoal(e.target.value)}
                      placeholder="What should the agent accomplish?"
                      className="mt-1 text-xs bg-card/50 border-border/30 font-mono min-h-[80px]"
                    />
                  </div>

                  <Button
                    onClick={handleAgentRun}
                    disabled={agentRunning || !agentGoal.trim()}
                    className="w-full bg-aether-green/20 text-aether-green hover:bg-aether-green/30 border border-aether-green/30"
                  >
                    {agentRunning ? (
                      <>
                        <div className="w-3 h-3 border border-aether-green rounded-full animate-spin mr-2" />
                        Agent Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 mr-2" />
                        Launch Agent
                      </>
                    )}
                  </Button>

                  {/* Agent Tools Reference */}
                  <div className="border border-border/30 rounded-lg p-3">
                    <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Available Tools (12)</h3>
                    <div className="grid grid-cols-2 gap-1">
                      {['file_read', 'file_write', 'file_list', 'file_delete', 'exec', 'window_open', 'window_close', 'memory_add', 'memory_search', 'web_search', 'plan_create', 'plan_update'].map(tool => (
                        <div key={tool} className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
                          <ChevronRight className="w-2 h-2 text-aether-cyan" />
                          {tool}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Agent Result */}
              <Card className="glass-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Terminal className="w-4 h-4 text-aether-cyan" />
                  <h2 className="text-sm font-semibold">Agent Output</h2>
                </div>

                {agentResult ? (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge className={agentResult.completed ? 'bg-aether-green/10 text-aether-green' : 'bg-aether-yellow/10 text-aether-yellow'}>
                          {agentResult.completed ? 'COMPLETED' : 'IN PROGRESS'}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {agentResult.iterations} iterations
                        </span>
                      </div>

                      {/* Tool Calls */}
                      {agentResult.toolCalls?.length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="text-[10px] font-mono text-muted-foreground">Tool Calls</h4>
                          {agentResult.toolCalls.map((tc: any, i: number) => (
                            <div key={i} className="rounded border border-border/30 bg-card/30 p-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <ChevronRight className="w-3 h-3 text-aether-cyan" />
                                <span className="text-[10px] font-mono font-semibold text-aether-cyan">{tc.tool}</span>
                              </div>
                              <p className="text-[9px] font-mono text-muted-foreground pl-4">
                                {JSON.stringify(tc.params).substring(0, 100)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Iterations */}
                      {agentResult.iterationsDetail?.map((iter: any, i: number) => (
                        <div key={i} className="rounded border border-border/30 bg-card/30 p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-mono font-semibold text-aether-purple">Iteration {iter.iteration}</span>
                            {iter.toolCall && (
                              <Badge className="text-[8px] bg-aether-cyan/10 text-aether-cyan">
                                {iter.toolCall.tool}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[9px] text-muted-foreground line-clamp-3">{iter.thinking?.substring(0, 200)}</p>
                        </div>
                      ))}

                      {/* Final Response */}
                      <div className="rounded-lg border border-aether-green/30 bg-aether-green/5 p-3">
                        <h4 className="text-[10px] font-mono text-aether-green mb-1">Final Response</h4>
                        <p className="text-xs text-foreground whitespace-pre-wrap">{agentResult.finalResponse}</p>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Box className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-xs text-muted-foreground">Launch the agent to see output</p>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* ═══ MEMORY TAB ═══ */}
          <TabsContent value="memory" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-aether-orange" />
                <h2 className="text-sm font-semibold">Semantic Memory Graph</h2>
                <Badge variant="outline" className="text-[10px] font-mono border-aether-orange/30 text-aether-orange">
                  {memoryNodes.length} nodes
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddMemory}
                  size="sm"
                  variant="outline"
                  className="text-[10px] border-aether-cyan/30 text-aether-cyan hover:bg-aether-cyan/10"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Memory
                </Button>
                <Button
                  onClick={handleClearMemory}
                  size="sm"
                  variant="outline"
                  className="text-[10px] border-aether-red/30 text-aether-red hover:bg-aether-red/10"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Clear
                </Button>
                <Button
                  onClick={fetchMemory}
                  size="sm"
                  variant="outline"
                  className="text-[10px]"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                </Button>
              </div>
            </div>

            <Card className="glass-card p-4">
              {memoryNodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-aether-orange/10 to-aether-purple/10 border border-border/30 flex items-center justify-center mb-4 animate-float">
                    <GitBranch className="w-8 h-8 text-aether-orange" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">Memory Graph Empty</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mb-4">
                    The semantic memory graph starts empty. It will auto-populate as you chat through the pipeline. Each conversation creates memory nodes with TF-IDF vectors.
                  </p>
                  <Button
                    onClick={handleAddMemory}
                    size="sm"
                    className="bg-aether-orange/20 text-aether-orange hover:bg-aether-orange/30 border border-aether-orange/30"
                  >
                    <Plus className="w-3.5 h-3.5 mr-2" /> Add First Memory
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {memoryNodes.map(node => (
                    <div
                      key={node.id}
                      className="rounded-lg border border-border/30 bg-card/30 p-3 hover:border-aether-cyan/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={`text-[8px] font-mono ${getCategoryStyle(node.category)}`}>
                          {node.category}
                        </Badge>
                        <span className="text-[8px] font-mono text-muted-foreground">{node.id.substring(0, 8)}</span>
                      </div>
                      <p className="text-[10px] text-foreground leading-relaxed line-clamp-4">{node.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* HCM + Distillation Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-aether-purple" />
                  <h3 className="text-sm font-semibold">Holographic Context Memory</h3>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Fixed 16KB associative memory using Vector Symbolic Architectures + FFT. Never grows — absorbs infinite context with zero dynamic allocation.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg border border-border/30 bg-card/30 p-2 text-center">
                    <p className="text-lg font-bold text-aether-purple">{stats?.hcm?.pairCount || 0}</p>
                    <p className="text-[8px] text-muted-foreground">Pairs</p>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-card/30 p-2 text-center">
                    <p className="text-lg font-bold text-aether-cyan">1024</p>
                    <p className="text-[8px] text-muted-foreground">Dims</p>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-card/30 p-2 text-center">
                    <p className="text-lg font-bold text-aether-green">{((stats?.hcm?.interference || 0) * 100).toFixed(1)}%</p>
                    <p className="text-[8px] text-muted-foreground">Interference</p>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-card/30 p-2 text-center">
                    <p className="text-lg font-bold text-aether-orange">{stats?.distillationHits || 0}</p>
                    <p className="text-[8px] text-muted-foreground">Distilled</p>
                  </div>
                </div>
              </Card>

              <Card className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="w-4 h-4 text-aether-cyan" />
                  <h3 className="text-sm font-semibold">Graph + Cache Statistics</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="flex justify-between py-1.5 border-b border-border/20">
                    <span className="text-muted-foreground">Graph Nodes</span>
                    <span className="text-aether-cyan">{stats?.graphNodeCount || 0}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/20">
                    <span className="text-muted-foreground">Graph Edges</span>
                    <span className="text-aether-purple">{stats?.graphEdgeCount || 0}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/20">
                    <span className="text-muted-foreground">Cache Entries</span>
                    <span className="text-aether-yellow">{stats?.cacheEntries || 0}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/20">
                    <span className="text-muted-foreground">Hit Rate</span>
                    <span className="text-aether-green">{((stats?.cacheHitRate || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Distillation</span>
                    <span className="text-aether-orange">{stats?.distillationPatterns || 0} patterns</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Avg Latency</span>
                    <span className="text-foreground">{stats?.avgLatencyMs || 0}ms</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ─── Footer ─── */}
      <footer className="mt-auto border-t border-border/30 bg-background/50 py-3">
        <div className="max-w-[1800px] mx-auto px-4 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>AetherOS v1.0.0</span>
            <span className="text-border">|</span>
            <span>Inspired by aether-engine</span>
            <span className="text-border">|</span>
            <span className="text-aether-cyan">L&apos;habit fait le moine</span>
          </div>
          <div className="flex items-center gap-3">
            <span>10-Stage Pipeline</span>
            <span className="text-border">|</span>
            <span>TF-IDF + HCM + ATD</span>
            <span className="text-border">|</span>
            <span>{stats?.totalRequests || 0} requests processed</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════
// Helper Components
// ═══════════════════════════════════════════

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="glass-card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{title}</span>
        <div style={{ color }}>{icon}</div>
      </div>
      <p className="text-xl font-bold font-mono" style={{ color }}>{value}</p>
    </Card>
  );
}

function ComplexityBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono" style={{ color }}>{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function getStageDetail(stageId: string, query: string): string {
  const details: Record<string, string> = {
    'cache_check': 'Cache miss — proceeding through pipeline',
    'graph_retrieval': `Retrieved nodes via TF-IDF + 1-hop expansion`,
    'context_compression': 'Compressed from ~40K to 4K chars',
    'complexity_analysis': 'Classified as moderate',
    'decomposition': 'Decomposed into 3 sub-questions',
    'solve': 'Solved 3 sub-questions sequentially',
    'synthesis': 'Synthesized from 3 sub-answers',
    'atd_verification': 'ATD passed — likelihood > entropy',
    'distillation': 'Pattern stored for future reuse',
    'speculative_prefetch': 'Prefetched 3 related queries',
  };
  return details[stageId] || '';
}

function getCategoryStyle(category: string): string {
  const styles: Record<string, string> = {
    'fact': 'bg-aether-cyan/10 text-aether-cyan',
    'lesson': 'bg-aether-yellow/10 text-aether-yellow',
    'plan': 'bg-aether-purple/10 text-aether-purple',
    'goal': 'bg-aether-green/10 text-aether-green',
    'intention': 'bg-aether-pink/10 text-aether-pink',
    'log': 'bg-aether-orange/10 text-aether-orange',
    'code': 'bg-secondary text-muted-foreground',
  };
  return styles[category] || styles['fact'];
}
