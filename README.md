# ⚡ AetherOS v2 — Local AI Orchestration Engine

> *"L'habit fait le moine"* — The outfit makes the monk. A 1.2B model with the right scaffolding outperforms a 70B model flying blind.

**100% local. Zero cloud. Zero API keys.** Drop a GGUF in `models/`, start the app, and the cognitive pipeline transforms your small model into an AGI-grade agent.

AetherOS is a **cognitive framework** that makes small local AI models act like super agents through a 10-stage pipeline. Inspired by [aether-engine](https://github.com/AFKmoney/aether-engine), rebuilt as a full-stack TypeScript platform with a Z.ai-style interface and persistent virtual file system.

---

## 🖥️ Interface

A clean, minimal chat interface inspired by Z.ai — built for the local-first workflow:

- **Sidebar** — conversation history, persisted across sessions
- **Chat** — markdown rendering, code blocks, inline pipeline thinking (collapsible accordions like Z.ai reasoning)
- **VFS Panel** — persistent virtual file system with tree view, file editor, upload
- **Pipeline Visibility** — every response shows which pipeline stages ran, ATD verification status, cache hits, and complexity classification
- **Model Indicator** — sidebar shows active GGUF model status (green/red)

No bloated dashboards. Just you, your model, and the scaffolding that makes it smart.

---

## 🧠 Core Thesis

Instead of scaling up models, scale up the **scaffolding** around them:

1. **External memory** replaces limited context windows (semantic graph + holographic memory)
2. **Task decomposition** breaks complex queries into simple sub-tasks any model can solve
3. **Self-verification** catches errors post-generation and forces intelligent retries
4. **Pattern distillation** learns from successful reasoning paths without changing weights
5. **Holographic compression** stores infinite context in a fixed 16KB buffer

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Z.ai-Style Chat Interface                   │
│   Sidebar · Chat · VFS Panel · Pipeline Thinking        │
├─────────────────────────────────────────────────────────┤
│             10-Stage Cognitive Pipeline                   │
│  Cache → Graph → Compress → Classify → Decompose →      │
│  Solve → Synthesize → ATD Verify → Distill → Prefetch   │
├─────────────────────────────────────────────────────────┤
│                   Engine Core                             │
│  TF-IDF │ Semantic Graph │ HCM (FFT) │ ATD │ Cache      │
├─────────────────────────────────────────────────────────┤
│            Local GGUF Inference Engine                    │
│  llama.cpp │ Ollama │ Any OpenAI-compatible server       │
│  Auto-detect · Auto-start · 100% offline                 │
├─────────────────────────────────────────────────────────┤
│             Persistent VFS + Memory Graph                 │
│  localStorage · File Tree · Editor · Upload              │
└─────────────────────────────────────────────────────────┘
```

---

## 🔥 The 10-Stage Cognitive Pipeline

Every message you send flows through these stages before you see a response:

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

Each stage is visible in the chat UI as collapsible "Pipeline thinking" accordions — you see exactly what the framework did to augment your small model.

---

## ⚔️ Asymmetric Tensor Dueling (ATD)

The verification engine that ensures response quality:

- **Graph A (Instinct)**: `likelihood = 0.6 × relevance + 0.4 × length_score`
- **Graph B (Verifier)**: `entropy = 0.4 × (1-vocab_diversity) + 0.4 × repetition_ratio + 0.2 × sentence_variance`
- **Validated** iff: `collision_delta > 0` AND `entropy ≤ 0.65` AND `repetition ≤ 0.30` AND `likelihood ≥ 0.3`
- **Smart retry**: adjusts temperature or rephrases prompt based on failure mode

---

## 🔮 Holographic Context Memory (HCM)

Fixed-size associative memory using Vector Symbolic Architectures + FFT:

- **Write**: `state += IFFT(FFT(key) ⊙ FFT(value))` — circular convolution
- **Read**: `value ≈ IFFT(conj(FFT(state)) ⊙ FFT(key))` — circular correlation
- **Memory**: O(D) — **never grows**. 1024-dim = **16 KB** holds ~100 pairs
- **SNR**: O(1/√M) where M = stored pairs

---

## 📂 Persistent VFS (Virtual File System)

A localStorage-backed file system that persists across sessions:

- **File tree** — hierarchical directory structure with expand/collapse
- **File editor** — inline editing with save
- **File upload** — drag & drop or upload button
- **File search** — search by name or content
- **Agent integration** — the autonomous agent can read/write VFS files via `file_read` / `file_write` tools

The VFS gives your small model a persistent workspace — it can write code, save notes, and reference files across conversations.

---

## 🤖 Autonomous Agent

Perceive → Think → Act → Execute → Observe → Repeat

12 built-in tools: `file_read`, `file_write`, `file_list`, `file_delete`, `exec`, `window_open`, `window_close`, `memory_add`, `memory_search`, `web_search`, `plan_create`, `plan_update`

Robust tool-call parser handles every format small GGUF models produce: inline JSON, fenced blocks, OpenAI function-call, wrapper arrays, alternate field names.

---

## 📁 Project Structure

```
aetherv2/
├── models/                    # Drop your GGUF files here
├── src/
│   ├── lib/engine/            # Core cognitive engine
│   │   ├── tfidf.ts           # TF-IDF vectorizer + cosine similarity
│   │   ├── graph.ts           # Semantic memory graph with 1-hop expansion
│   │   ├── compress.ts        # 3-strategy context compressor (10:1 ratio)
│   │   ├── decompose.ts       # Cognitive decomposer (4 strategies)
│   │   ├── atd.ts             # Asymmetric Tensor Dueling verification
│   │   ├── hcm.ts             # Holographic Context Memory (VSA + FFT)
│   │   ├── cache.ts           # Dual semantic cache (action + retrieval)
│   │   ├── distill.ts         # Knowledge distillation store
│   │   ├── inference.ts       # Local GGUF inference engine (llama.cpp/Ollama)
│   │   ├── router.ts          # Model complexity router
│   │   ├── pipeline.ts        # 10-stage cognitive pipeline orchestrator
│   │   ├── instance.ts        # Singleton pipeline + inference instance
│   │   ├── vfs.ts             # Persistent Virtual File System
│   │   ├── types.ts           # TypeScript type definitions
│   │   └── index.ts           # Unified export
│   ├── app/
│   │   ├── page.tsx           # Z.ai-style chat interface
│   │   ├── layout.tsx         # Dark theme root layout
│   │   ├── globals.css        # Cyberpunk dark theme
│   │   └── api/
│   │       ├── chat/          # OpenAI-compatible chat completions
│   │       ├── agent/         # Autonomous agent loop
│   │       ├── graph/         # Semantic memory graph CRUD
│   │       ├── inference/     # Local model start/stop/status
│   │       ├── stats/         # Pipeline telemetry
│   │       └── models/        # Model fleet listing
│   └── components/ui/         # shadcn/ui components
└── prisma/
    └── schema.prisma          # Database schema
```

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/AFKmoney/aetherv2.git
cd aetherv2

# Drop your GGUF model (1-3B Q4_K_M recommended)
cp ~/Downloads/your-model-Q4_K_M.gguf models/

# Install
npm install

# Run
npm run dev

# Open
http://localhost:3000
```

### Inference Backends (pick one)

AetherOS needs a local GGUF inference server. It auto-detects:

1. **llama.cpp** (recommended) — copy `llama-server` binary to `bin/`
2. **Ollama** — install and run `ollama serve`
3. **Any OpenAI-compatible server** running on port 8081

The app auto-starts the backend when you click "Start" in the Model tab.

### Recommended GGUF Models

| Model | Size | Why |
|-------|------|-----|
| Phi-3-mini (3.8B Q4) | ~2.2GB | Best quality/size ratio for the pipeline |
| Qwen2.5-1.5B Q4_K_M | ~900MB | Tiny but surprisingly capable with scaffolding |
| Llama-3.2-1B Q4_K_M | ~700MB | Minimal footprint, pipeline does the heavy lifting |
| Gemma-2-2B Q4_K_M | ~1.4GB | Google's small model, strong reasoning |

The smaller the model, the more the pipeline matters. That's the point.

---

## 🔧 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Full 10-stage pipeline (OpenAI-compatible format) |
| `POST` | `/api/agent` | Run autonomous agent loop |
| `POST` | `/api/graph` | Add/search/clear memory nodes |
| `GET` | `/api/graph` | Get full graph for visualization |
| `GET` | `/api/stats` | Pipeline telemetry & system stats |
| `GET` | `/api/models` | Available model fleet |
| `GET` | `/api/inference` | Local GGUF model status |
| `POST` | `/api/inference` | Start/stop/discover local models |

---

## 🎯 The "Super Agent Outfit" Pattern

The core innovation: **making small models act big through external scaffolding**

| What big models do internally | What AetherOS does externally |
|-------------------------------|-------------------------------|
| Long context window | Semantic memory graph (infinite) |
| Chain-of-thought reasoning | Task decomposition + sequential solving |
| Self-correction | ATD verification + smart retries |
| Learning from examples | Distillation of successful patterns |
| Internal knowledge | Holographic associative memory (16KB) |
| File system access | Persistent VFS with read/write tools |
| Conversation memory | localStorage conversation history |

The pipeline **remembers FOR the model**, **decomposes FOR the model**, and **verifies FOR the model**. The model is just the engine. The framework is the intelligence.

---

## 📜 License

MIT © AFKmoney 2026

## 🙏 Credits

- Original Rust engine: [aether-engine](https://github.com/AFKmoney/aether-engine)
- Built with [Next.js](https://nextjs.org), [TypeScript](https://typescriptlang.org), [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com)
