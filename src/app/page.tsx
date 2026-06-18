'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Send, MessageSquare, Settings, Trash2, ChevronDown, ChevronRight,
  Copy, Check, FolderOpen, FileText, Folder, File, Upload, X,
  Zap, Brain, GitBranch, Shield, Database, Sparkles, Terminal,
  Flame, Layers, Radio, Cpu, RotateCcw, PanelRightOpen, PanelRightClose,
  Edit3, Download, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { VirtualFileSystem, VFSNode, VFSFile } from '@/lib/engine/vfs';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: ThinkingBlock[];
  pipelineInfo?: PipelineInfo;
  timestamp: number;
}

interface ThinkingBlock {
  label: string;
  content: string;
  durationMs: number;
  status: 'pass' | 'fail' | 'info';
}

interface PipelineInfo {
  complexity: string;
  model: string;
  latencyMs: number;
  cacheHit: boolean;
  atdPassed: boolean;
  stages: StageInfo[];
}

interface StageInfo {
  id: string;
  label: string;
  durationMs: number;
  status: string;
  detail: string;
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

// Pipeline stage metadata
const STAGES: Array<{ id: string; label: string; desc: string; color: string }> = [
  { id: 'cache_check', label: 'Cache', desc: 'O(1) hash + semantic scan', color: '#eab308' },
  { id: 'graph_retrieval', label: 'Graph', desc: 'TF-IDF + 1-hop expansion', color: '#00f0ff' },
  { id: 'context_compression', label: 'Compress', desc: '40K → 4K pipeline', color: '#a855f7' },
  { id: 'complexity_analysis', label: 'Complexity', desc: 'Rule-based classifier', color: '#ec4899' },
  { id: 'decomposition', label: 'Decompose', desc: '4 strategies + distillation', color: '#f97316' },
  { id: 'solve', label: 'Solve', desc: 'Sequential sub-question solving', color: '#22c55e' },
  { id: 'synthesis', label: 'Synthesis', desc: 'Combine sub-answers', color: '#06b6d4' },
  { id: 'atd_verification', label: 'ATD', desc: 'Likelihood vs entropy', color: '#ef4444' },
  { id: 'distillation', label: 'Distill', desc: 'Store successful patterns', color: '#8b5cf6' },
  { id: 'speculative_prefetch', label: 'Prefetch', desc: 'Warm related caches', color: '#14b8a6' },
];

// ═══════════════════════════════════════════
// Main App — Z.ai Clone
// ═══════════════════════════════════════════

export default function AetherOSPage() {
  // ─── State ───
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [vfs] = useState(() => new VirtualFileSystem());
  const [showVFS, setShowVFS] = useState(false);
  const [vfsTree, setVfsTree] = useState<VFSNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<VFSFile | null>(null);
  const [editingFile, setEditingFile] = useState<VFSFile | null>(null);
  const [editContent, setEditContent] = useState('');
  const [inferenceStatus, setInferenceStatus] = useState<InferenceStatus | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const [expandedPipeline, setExpandedPipeline] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [vfsSearchQuery, setVfsSearchQuery] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Active conversation
  const activeConvo = conversations.find(c => c.id === activeConvoId);

  // ─── Load from localStorage ───
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aetheros-conversations');
      if (saved) setConversations(JSON.parse(saved));
    } catch {}
    // Load inference status
    fetchInference();
  }, []);

  // ─── Save to localStorage ───
  useEffect(() => {
    localStorage.setItem('aetheros-conversations', JSON.stringify(conversations));
  }, [conversations]);

  // ─── Auto-scroll ───
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConvo?.messages?.length]);

  // ─── VFS tree ───
  useEffect(() => {
    const update = () => setVfsTree(vfs.getTree());
    update();
    return vfs.onChange(update);
  }, [vfs]);

  // ─── Inference status ───
  const fetchInference = useCallback(async () => {
    try {
      const res = await fetch('/api/inference');
      if (res.ok) {
        const data = await res.json();
        setInferenceStatus({ ...data.status, models: data.models || [] });
      }
    } catch {}
  }, []);

  // ─── New conversation ───
  const handleNewChat = () => {
    const convo: Conversation = {
      id: `conv_${Date.now()}`,
      title: 'New conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(prev => [convo, ...prev]);
    setActiveConvoId(convo.id);
    setInputValue('');
    inputRef.current?.focus();
  };

  // ─── Delete conversation ───
  const handleDeleteConvo = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) setActiveConvoId(null);
  };

  // ─── Send message ───
  const handleSend = async () => {
    if (!inputValue.trim() || isGenerating) return;

    let convoId = activeConvoId;
    let convo = conversations.find(c => c.id === convoId);

    // Create new conversation if needed
    if (!convo) {
      convo = {
        id: `conv_${Date.now()}`,
        title: inputValue.trim().substring(0, 50),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      convoId = convo.id;
      setConversations(prev => [convo!, ...prev]);
      setActiveConvoId(convoId);
    }

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    // Update title if first message
    const isFirst = convo.messages.length === 0;

    setConversations(prev => prev.map(c =>
      c.id === convoId
        ? {
            ...c,
            title: isFirst ? inputValue.trim().substring(0, 50) : c.title,
            messages: [...c.messages, userMsg],
            updatedAt: Date.now(),
          }
        : c
    ));

    setInputValue('');
    setIsGenerating(true);

    try {
      // Call the pipeline API
      const allMessages = [...(convo.messages || []), userMsg];
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aether = data.aether || {};

        // Build thinking blocks from pipeline stages
        const thinking: ThinkingBlock[] = (aether.pipelineStages || [])
          .filter((s: any) => s.status === 'completed' && s.detail)
          .map((s: any) => ({
            label: STAGES.find(st => st.id === s.stage)?.label || s.stage,
            content: s.detail,
            durationMs: s.durationMs,
            status: s.detail.toLowerCase().includes('pass') || s.detail.toLowerCase().includes('hit')
              ? 'pass' as const
              : s.detail.toLowerCase().includes('fail')
                ? 'fail' as const
                : 'info' as const,
          }));

        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_asst`,
          role: 'assistant',
          content: data.choices?.[0]?.message?.content || 'No response',
          thinking: thinking.length > 0 ? thinking : undefined,
          pipelineInfo: {
            complexity: aether.complexity || 'simple',
            model: data.model || 'aether-pipeline',
            latencyMs: aether.totalLatencyMs || 0,
            cacheHit: aether.cacheHit || false,
            atdPassed: aether.atdPassed || false,
            stages: (aether.pipelineStages || []).map((s: any) => ({
              id: s.stage,
              label: STAGES.find(st => st.id === s.stage)?.label || s.stage,
              durationMs: s.durationMs,
              status: s.status,
              detail: s.detail,
            })),
          },
          timestamp: Date.now(),
        };

        setConversations(prev => prev.map(c =>
          c.id === convoId
            ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: Date.now() }
            : c
        ));
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsGenerating(false);
      fetchInference();
    }
  };

  // ─── VFS operations ───
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      for (const file of Array.from(files)) {
        const content = await file.text();
        vfs.writeFile(`/workspace/${file.name}`, content, file.type);
      }
    };
    input.click();
  };

  const handleNewFile = () => {
    const name = prompt('File name:', 'untitled.txt');
    if (!name) return;
    const file = vfs.writeFile(`/workspace/${name}`, '');
    setSelectedFile(file);
    setEditingFile(file);
    setEditContent('');
  };

  const handleSaveFile = () => {
    if (!editingFile) return;
    vfs.writeFile(editingFile.path, editContent, editingFile.mimeType);
    setEditingFile(null);
  };

  const handleDeleteVFSFile = (path: string) => {
    vfs.deleteFile(path);
    if (selectedFile?.path === path) setSelectedFile(null);
    if (editingFile?.path === path) setEditingFile(null);
  };

  // ─── Copy ───
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ─── Toggle thinking/pipeline ───
  const toggleThinking = (msgId: string) => {
    setExpandedThinking(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  };

  const togglePipeline = (msgId: string) => {
    setExpandedPipeline(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  return (
    <div className="h-screen flex bg-[#0a0a0f] text-[#e4e4ef] overflow-hidden">
      {/* ═══ SIDEBAR ═══ */}
      {sidebarOpen && (
        <div className="w-[260px] flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-[#0d0d14]">
          {/* Sidebar header */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#a855f7] flex items-center justify-center">
                <Zap className="w-4 h-4 text-black" />
              </div>
              <span className="text-sm font-bold tracking-tight">
                <span className="text-[#00f0ff]">Aether</span>OS
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-md hover:bg-white/5 text-[#71717a] hover:text-[#e4e4ef] transition-colors"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>

          {/* New chat */}
          <div className="px-3 pb-2">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New conversation
            </button>
          </div>

          {/* Model indicator */}
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] text-[10px] font-mono text-[#71717a]">
              <Cpu className={`w-3 h-3 ${inferenceStatus?.running ? 'text-[#22c55e]' : 'text-[#ef4444]'}`} />
              {inferenceStatus?.running
                ? inferenceStatus.model?.substring(0, 20)
                : 'No model loaded'}
            </div>
          </div>

          <Separator className="bg-white/[0.04]" />

          {/* Conversations list */}
          <ScrollArea className="flex-1 px-2 py-1">
            <div className="space-y-0.5">
              {conversations.map(convo => (
                <div
                  key={convo.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    activeConvoId === convo.id
                      ? 'bg-white/[0.06] text-[#e4e4ef]'
                      : 'text-[#71717a] hover:bg-white/[0.03] hover:text-[#e4e4ef]'
                  }`}
                  onClick={() => setActiveConvoId(convo.id)}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs truncate flex-1">{convo.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteConvo(convo.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#ef4444] transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Sidebar footer */}
          <div className="p-3 border-t border-white/[0.04]">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowVFS(!showVFS)}
                className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md transition-colors ${
                  showVFS ? 'bg-[#a855f7]/10 text-[#a855f7]' : 'text-[#71717a] hover:text-[#e4e4ef]'
                }`}
              >
                <FolderOpen className="w-3 h-3" /> VFS
              </button>
              <span className="text-[9px] font-mono text-[#333]">aetherv2</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-md hover:bg-white/5 text-[#71717a] hover:text-[#e4e4ef] transition-colors"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>
            )}
            <span className="text-sm font-medium truncate">
              {activeConvo?.title || 'AetherOS'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeConvo && (
              <>
                <Badge className={`text-[8px] font-mono ${
                  activeConvo.messages.length > 0 && activeConvo.messages[activeConvo.messages.length - 1].pipelineInfo?.complexity === 'complex'
                    ? 'bg-[#ef4444]/10 text-[#ef4444]'
                    : activeConvo.messages.length > 0 && activeConvo.messages[activeConvo.messages.length - 1].pipelineInfo?.complexity === 'moderate'
                      ? 'bg-[#eab308]/10 text-[#eab308]'
                      : 'bg-[#22c55e]/10 text-[#22c55e]'
                }`}>
                  {activeConvo.messages.length > 0 ? activeConvo.messages[activeConvo.messages.length - 1].pipelineInfo?.complexity || 'ready' : 'ready'}
                </Badge>
                <button
                  onClick={() => { /* regenerate */ }}
                  className="p-1.5 rounded-md hover:bg-white/5 text-[#71717a] hover:text-[#e4e4ef] transition-colors"
                  disabled={isGenerating}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto">
          {!activeConvo || activeConvo.messages.length === 0 ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00f0ff]/10 to-[#a855f7]/10 border border-white/[0.06] flex items-center justify-center mb-6">
                <Zap className="w-8 h-8 text-[#00f0ff]" />
              </div>
              <h1 className="text-2xl font-bold mb-2">
                <span className="text-[#00f0ff]">Aether</span>OS
              </h1>
              <p className="text-sm text-[#71717a] mb-8 text-center max-w-md">
                Drop a GGUF in models/, power the cognitive pipeline, and watch a 1.2B model outperform a 70B. L&apos;habit fait le moine.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {[
                  { label: 'Design a distributed cache system', icon: <Database className="w-4 h-4" /> },
                  { label: 'Compare React vs Vue architecture', icon: <GitBranch className="w-4 h-4" /> },
                  { label: 'Explain quantum computing step by step', icon: <Brain className="w-4 h-4" /> },
                  { label: 'Write a Rust implementation of B-tree', icon: <Terminal className="w-4 h-4" /> },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputValue(item.label); }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="text-[#71717a]">{item.icon}</div>
                    <span className="text-xs text-[#71717a]">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-[768px] mx-auto px-4 py-6">
              {activeConvo.messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  copiedId={copiedId}
                  expandedThinking={expandedThinking.has(msg.id)}
                  expandedPipeline={expandedPipeline.has(msg.id)}
                  onToggleThinking={() => toggleThinking(msg.id)}
                  onTogglePipeline={() => togglePipeline(msg.id)}
                  onCopy={(text) => handleCopy(text, msg.id)}
                />
              ))}

              {isGenerating && (
                <div className="flex items-center gap-2 py-4">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-[#00f0ff] rounded-full animate-pulse" />
                    <div className="w-1.5 h-1.5 bg-[#a855f7] rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    <div className="w-1.5 h-1.5 bg-[#ec4899] rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />
                  </div>
                  <span className="text-[11px] text-[#71717a]">Pipeline processing...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-white/[0.04] bg-[#0a0a0f]">
          <div className="max-w-[768px] mx-auto px-4 py-3">
            <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-[#12121a] px-4 py-3">
              <textarea
                ref={inputRef as any}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                placeholder="Message AetherOS..."
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-[#333] max-h-[200px] min-h-[24px]"
                style={{ height: 'auto', overflow: 'hidden' }}
                onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }}
                disabled={isGenerating}
              />
              <button
                onClick={handleSend}
                disabled={isGenerating || !inputValue.trim()}
                className={`p-2 rounded-lg transition-colors ${
                  inputValue.trim() && !isGenerating
                    ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80'
                    : 'bg-white/[0.04] text-[#333]'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-[#333] text-center mt-2 font-mono">
              AetherOS v2 · 10-stage cognitive pipeline · 100% local · L&apos;habit fait le moine
            </p>
          </div>
        </div>
      </div>

      {/* ═══ VFS PANEL ═══ */}
      {showVFS && (
        <div className="w-[300px] flex-shrink-0 flex flex-col border-l border-white/[0.06] bg-[#0d0d14]">
          {/* VFS header */}
          <div className="p-3 flex items-center justify-between border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#a855f7]" />
              <span className="text-xs font-semibold">Virtual File System</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleNewFile} className="p-1 rounded hover:bg-white/5 text-[#71717a] hover:text-[#e4e4ef]">
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleFileUpload} className="p-1 rounded hover:bg-white/5 text-[#71717a] hover:text-[#e4e4ef]">
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowVFS(false)} className="p-1 rounded hover:bg-white/5 text-[#71717a] hover:text-[#e4e4ef]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* VFS search */}
          <div className="px-3 py-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <Search className="w-3 h-3 text-[#333]" />
              <input
                value={vfsSearchQuery}
                onChange={e => setVfsSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#333]"
              />
            </div>
          </div>

          {/* File tree or editor */}
          {editingFile ? (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-3 h-3 text-[#00f0ff]" />
                  <span className="text-[10px] font-mono">{editingFile.name}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={handleSaveFile} className="px-2 py-0.5 rounded text-[9px] bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20">
                    Save
                  </button>
                  <button onClick={() => setEditingFile(null)} className="px-2 py-0.5 rounded text-[9px] text-[#71717a] hover:bg-white/5">
                    Cancel
                  </button>
                </div>
              </div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="flex-1 bg-transparent p-3 text-[10px] font-mono resize-none outline-none"
                spellCheck={false}
              />
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-2">
                {vfsTree ? (
                  <VFSTree
                    node={vfsTree}
                    vfs={vfs}
                    selectedPath={selectedFile?.path}
                    onSelect={(file) => { setSelectedFile(file); }}
                    onEdit={(file) => { setEditingFile(file); setEditContent(file.content); }}
                    onDelete={(path) => handleDeleteVFSFile(path)}
                  />
                ) : (
                  <p className="text-[10px] text-[#333] text-center py-8">No files yet</p>
                )}
              </div>
            </ScrollArea>
          )}

          {/* File preview */}
          {selectedFile && !editingFile && (
            <div className="border-t border-white/[0.04] max-h-[200px] overflow-auto">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[9px] font-mono text-[#71717a]">{selectedFile.path}</span>
                <span className="text-[8px] font-mono text-[#333]">{selectedFile.size}B</span>
              </div>
              <pre className="px-3 pb-2 text-[9px] font-mono text-[#71717a] whitespace-pre-wrap break-all">
                {selectedFile.content.substring(0, 500)}
                {selectedFile.content.length > 500 ? '...' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Message Bubble Component — Z.ai style
// ═══════════════════════════════════════════

function MessageBubble({
  message,
  copiedId,
  expandedThinking,
  expandedPipeline,
  onToggleThinking,
  onTogglePipeline,
  onCopy,
}: {
  message: ChatMessage;
  copiedId: string | null;
  expandedThinking: boolean;
  expandedPipeline: boolean;
  onToggleThinking: () => void;
  onTogglePipeline: () => void;
  onCopy: (text: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`py-4 ${isUser ? '' : ''}`}>
      {isUser ? (
        /* User message */
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#1a1a2e] px-4 py-2.5">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      ) : (
        /* Assistant message */
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00f0ff]/20 to-[#a855f7]/20 border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap className="w-3.5 h-3.5 text-[#00f0ff]" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Thinking accordion */}
            {message.thinking && message.thinking.length > 0 && (
              <div className="mb-2">
                <button
                  onClick={onToggleThinking}
                  className="flex items-center gap-1.5 text-[11px] text-[#71717a] hover:text-[#a855f7] transition-colors"
                >
                  {expandedThinking ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <Sparkles className="w-3 h-3" />
                  <span>Pipeline thinking</span>
                  <span className="text-[9px] font-mono">({message.thinking.length} stages)</span>
                </button>
                {expandedThinking && (
                  <div className="mt-1.5 space-y-1 pl-1">
                    {message.thinking.map((block, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] font-mono">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                          block.status === 'pass' ? 'bg-[#22c55e]' :
                          block.status === 'fail' ? 'bg-[#ef4444]' : 'bg-[#00f0ff]'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-[#71717a]">{block.label}</span>
                          <span className="text-[#333] mx-1">·</span>
                          <span className="text-[#555]">{block.content}</span>
                          <span className="text-[#333] ml-1">{block.durationMs}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pipeline details accordion */}
            {message.pipelineInfo && (
              <div className="mb-2">
                <button
                  onClick={onTogglePipeline}
                  className="flex items-center gap-1.5 text-[11px] text-[#71717a] hover:text-[#00f0ff] transition-colors"
                >
                  {expandedPipeline ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <Shield className="w-3 h-3" />
                  <span>Pipeline details</span>
                  <div className="flex items-center gap-1 ml-1">
                    {message.pipelineInfo.atdPassed && <Badge className="text-[7px] bg-[#22c55e]/10 text-[#22c55e] h-4">ATD ✓</Badge>}
                    {message.pipelineInfo.cacheHit && <Badge className="text-[7px] bg-[#eab308]/10 text-[#eab308] h-4">CACHED</Badge>}
                    <Badge className={`text-[7px] h-4 ${
                      message.pipelineInfo.complexity === 'complex' ? 'bg-[#ef4444]/10 text-[#ef4444]' :
                      message.pipelineInfo.complexity === 'moderate' ? 'bg-[#eab308]/10 text-[#eab308]' :
                      'bg-[#22c55e]/10 text-[#22c55e]'
                    }`}>
                      {message.pipelineInfo.complexity}
                    </Badge>
                  </div>
                </button>
                {expandedPipeline && (
                  <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {message.pipelineInfo.stages.map((stage, i) => (
                      <div
                        key={stage.id}
                        className={`rounded-md px-1.5 py-1 text-[8px] font-mono border ${
                          stage.status === 'completed'
                            ? 'border-[#22c55e]/20 bg-[#22c55e]/5 text-[#22c55e]'
                            : stage.status === 'failed'
                              ? 'border-[#ef4444]/20 bg-[#ef4444]/5 text-[#ef4444]'
                              : 'border-white/[0.04] bg-white/[0.02] text-[#333]'
                        }`}
                      >
                        <div className="font-semibold">{stage.label}</div>
                        <div className="text-[7px] opacity-60">{stage.durationMs}ms</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="text-sm leading-relaxed prose-invert max-w-none">
              <MessageContent content={message.content} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 mt-2">
              <button
                onClick={() => onCopy(message.content)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[#333] hover:text-[#71717a] hover:bg-white/[0.03] transition-colors"
              >
                {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === message.id ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Message Content — Basic Markdown Rendering
// ═══════════════════════════════════════════

function MessageContent({ content }: { content: string }) {
  // Simple markdown: code blocks, bold, italic, headers, lists
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```') && !inCodeBlock) {
      inCodeBlock = true;
      codeLang = line.slice(3).trim();
      codeContent = '';
      continue;
    }

    if (line.startsWith('```') && inCodeBlock) {
      inCodeBlock = false;
      elements.push(
        <div key={`code-${i}`} className="relative my-2 rounded-lg border border-white/[0.06] bg-[#0a0a0f] overflow-hidden">
          {codeLang && (
            <div className="px-3 py-1 border-b border-white/[0.04] text-[9px] font-mono text-[#333]">{codeLang}</div>
          )}
          <pre className="p-3 text-[11px] font-mono overflow-x-auto text-[#e4e4ef]/80">
            {codeContent}
          </pre>
        </div>
      );
      continue;
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line;
      continue;
    }

    // Regular line rendering
    if (line.startsWith('### ')) {
      elements.push(<h3 key={`h3-${i}`} className="text-sm font-bold mt-3 mb-1">{formatInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={`h2-${i}`} className="text-base font-bold mt-4 mb-1">{formatInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={`h1-${i}`} className="text-lg font-bold mt-4 mb-2">{formatInline(line.slice(2))}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<div key={`li-${i}`} className="flex gap-2 ml-2"><span className="text-[#00f0ff]">•</span><span>{formatInline(line.slice(2))}</span></div>);
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+\.)\s(.*)/);
      elements.push(<div key={`oli-${i}`} className="flex gap-2 ml-2"><span className="text-[#a855f7] font-mono text-xs">{match?.[1]}</span><span>{formatInline(match?.[2] || '')}</span></div>);
    } else if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-2" />);
    } else {
      elements.push(<p key={`p-${i}`} className="whitespace-pre-wrap">{formatInline(line)}</p>);
    }
  }

  return <>{elements}</>;
}

function formatInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[#e4e4ef]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1 py-0.5 rounded bg-white/[0.06] text-[#00f0ff] text-[11px] font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// ═══════════════════════════════════════════
// VFS Tree Component
// ═══════════════════════════════════════════

function VFSTree({
  node,
  vfs,
  selectedPath,
  onSelect,
  onEdit,
  onDelete,
  depth = 0,
}: {
  node: VFSNode;
  vfs: VirtualFileSystem;
  selectedPath?: string;
  onSelect: (file: VFSFile) => void;
  onEdit: (file: VFSFile) => void;
  onDelete: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.name === '/' && node.children.length === 0) {
    return (
      <div className="text-center py-6">
        <FolderOpen className="w-6 h-6 text-[#333] mx-auto mb-2" />
        <p className="text-[10px] text-[#333]">No files yet</p>
        <p className="text-[9px] text-[#222]">Upload or create files</p>
      </div>
    );
  }

  return (
    <div>
      {node.name !== '/' && (
        <div
          className={`group flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer hover:bg-white/[0.03] transition-colors ${
            selectedPath === node.path ? 'bg-[#a855f7]/5 text-[#a855f7]' : 'text-[#71717a]'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              setExpanded(!expanded);
            } else if (node.file) {
              onSelect(node.file);
            }
          }}
        >
          {node.type === 'directory' ? (
            <>
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Folder className="w-3.5 h-3.5 text-[#eab308]" />
            </>
          ) : (
            <>
              <span className="w-3" />
              <File className="w-3.5 h-3.5 text-[#00f0ff]" />
            </>
          )}
          <span className="text-[10px] font-mono truncate flex-1">{node.name}</span>
          {node.type === 'file' && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button onClick={e => { e.stopPropagation(); node.file && onEdit(node.file); }} className="p-0.5 hover:text-[#00f0ff]">
                <Edit3 className="w-2.5 h-2.5" />
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(node.path); }} className="p-0.5 hover:text-[#ef4444]">
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {expanded && node.children.map(child => (
        <VFSTree
          key={child.path}
          node={child}
          vfs={vfs}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          depth={node.name === '/' ? 0 : depth + 1}
        />
      ))}
    </div>
  );
}
