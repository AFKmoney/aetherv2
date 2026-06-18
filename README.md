# ⚡ AetherOS v2 — Unified AI Orchestration Engine

> *"L'habit fait le moine"* — The outfit makes the monk. A 1.2B model with the right scaffolding outperforms a 70B model flying blind.

AetherOS is a **cognitive middleware** that makes small AI models act like super agents through a 10-stage pipeline. Inspired by [aether-engine](https://github.com/AFKmoney/aether-engine), rebuilt as a full-stack TypeScript platform with real-time visualization.

## 🧠 Core Thesis

Instead of scaling up models, scale up the **scaffolding** around them:

1. **External memory** replaces limited context windows (semantic graph + holographic memory)
2. **Task decomposition** breaks complex queries into simple sub-tasks any model can solve
3. **Self-verification** catches errors post-generation and forces intelligent retries
4. **Pattern distillation** learns from successful reasoning paths without changing weights
5. **Holographic compression** stores infinite context in a fixed 16KB buffer

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   AetherOS v2 Dashboard                  │
│    Real-time pipeline viz · Chat · Agent · Memory Graph  │
├──────────────────────────────────────────────────────────┤
│              10-Stage Cognitive Pipeline                  │
│  Cache → Graph → Compress → Classify → Decompose →      │
│  Solve → Synthesize → ATD Verify → Distill → Prefetch   │
├──────────────────────────────────────────────────────────┤
│                    Engine Core                            │
│  TF-IDF │ Semantic Graph │ HCM (FFT) │ ATD │ Cache      │
├──────────────────────────────────────────────────────────┤
│               Multi-Model Router                         │
│  Super Z │ Claude │ Nano Agent (1.2B) │ Medius (7B)     │
└──────────────────────────────────────────────────────────┘
```

## 🔥 The 10-Stage Cognitive Pipeline

Every request flows through these stages:

| # | Stage | What it does |
|---|-------|-------------|
| 1 | **Cache Check** | O(1) hash + O(N) semantic similarity scan (threshold 0.95) |
| 2 | **Graph Retrieval** | TF-IDF top-8 + 1-hop edge expansion with blended scoring |
| 3 | **Context Compression** | 3-strategy pipeline: TF-IDF ranking → sentence extraction → dedup (10:1 ratio) |
| 4 | **Complexity Analysis** | Rule-based classifier: Simple / Moderate / Complex |
| 5 | **Decomposition** | 4 strategies: conjunction split, numbered steps, comparison, generic fallback + distillation lookup |
| 6 | **Solve** | Sequential sub-question solving with dependency injection |
| 7 | **Synthesis** | Combine sub-answers into coherent response |
| 8 | **ATD Verification** | Dual-graph validation: likelihood vs entropy collision |
| 9 | **Distillation** | Store successful decomposition patterns for reuse |
| 10 | **Speculative Prefetch** | Warm cache for graph-adjacent queries |

## ⚔️ Asymmetric Tensor Dueling (ATD)

The verification engine that ensures response quality:

- **Graph A (Instinct)**: `likelihood = 0.6 × relevance + 0.4 × length_score`
- **Graph B (Verifier)**: `entropy = 0.4 × (1-vocab_diversity) + 0.4 × repetition_ratio + 0.2 × sentence_variance`
- **Validated** iff: `collision_delta > 0` AND `entropy ≤ 0.65` AND `repetition ≤ 0.30` AND `likelihood ≥ 0.3`
- **Smart retry**: adjusts temperature or rephrases prompt based on failure mode

## 🔮 Holographic Context Memory (HCM)

Fixed-size associative memory using Vector Symbolic Architectures + FFT:

- **Write**: `state += IFFT(FFT(key) ⊙ FFT(value))` — circular convolution
- **Read**: `value ≈ IFFT(conj(FFT(state)) ⊙ FFT(key))` — circular correlation
- **Memory**: O(D) — **never grows**. 1024-dim = **16 KB** holds ~100 pairs
- **SNR**: O(1/√M) where M = stored pairs

## 🤖 Autonomous Agent

Perceive → Think → Act → Execute → Observe → Repeat

12 built-in tools: `file_read`, `file_write`, `file_list`, `file_delete`, `exec`, `window_open`, `window_close`, `memory_add`, `memory_search`, `web_search`, `plan_create`, `plan_update`

Robust tool-call parser handles every format small GGUF models produce: inline JSON, fenced blocks, OpenAI function-call, wrapper arrays, alternate field names.

## 📁 Project Structure

```
src/
├── lib/engine/           # Core cognitive engine (ported from aether-engine Rust)
│   ├── tfidf.ts          # TF-IDF vectorizer + cosine similarity
│   ├── graph.ts          # Semantic memory graph with 1-hop expansion
│   ├── compress.ts       # 3-strategy context compressor (10:1 ratio)
│   ├── decompose.ts      # Cognitive decomposer (4 strategies)
│   ├── atd.ts            # Asymmetric Tensor Dueling verification
│   ├── hcm.ts            # Holographic Context Memory (VSA + FFT)
│   ├── cache.ts          # Dual semantic cache (action + retrieval)
│   ├── distill.ts        # Knowledge distillation store
│   ├── router.ts         # Multi-model router (Super Z, Claude, local)
│   ├── pipeline.ts       # 10-stage cognitive pipeline orchestrator
│   ├── instance.ts       # Singleton pipeline instance
│   ├── types.ts          # TypeScript type definitions
│   └── index.ts          # Unified export
├── app/
│   ├── page.tsx          # AetherOS Dashboard (dark cyberpunk UI)
│   ├── api/chat/         # OpenAI-compatible chat completions endpoint
│   ├── api/agent/        # Autonomous agent loop endpoint
│   ├── api/graph/        # Semantic memory graph CRUD
│   ├── api/stats/        # Pipeline telemetry
│   └── api/models/       # Model fleet listing
└── prisma/
    └── schema.prisma     # Database schema (conversations, memory, distillation)
```

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/AFKmoney/aetherv2.git
cd aetherv2

# Install
npm install

# Run
npm run dev

# Open
http://localhost:3000
```

## 🔧 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Full 10-stage pipeline (OpenAI-compatible format) |
| `POST` | `/api/agent` | Run autonomous agent loop |
| `POST` | `/api/graph` | Add/search/clear memory nodes |
| `GET`  | `/api/graph` | Get full graph for visualization |
| `GET`  | `/api/stats` | Pipeline telemetry & system stats |
| `GET`  | `/api/models` | Available model fleet |

## 🎯 The "Super Agent Outfit" Pattern

The core innovation: **making small models act big through external scaffolding**

| What big models do internally | What AetherOS does externally |
|------------------------------|-------------------------------|
| Long context window | Semantic memory graph (infinite) |
| Chain-of-thought reasoning | Task decomposition + sequential solving |
| Self-correction | ATD verification + smart retries |
| Learning from examples | Distillation of successful patterns |
| Internal knowledge | Holographic associative memory (16KB) |

## 📜 License

MIT © AFKmoney 2025

## 🙏 Credits

- Original Rust engine: [aether-engine](https://github.com/AFKmoney/aether-engine)
- Built with [Next.js](https://nextjs.org), [TypeScript](https://typescriptlang.org), [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com)
