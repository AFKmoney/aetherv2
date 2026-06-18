// AetherOS — Local GGUF Inference Engine
// Zero cloud, zero API keys. Drop a GGUF in models/ and go.
//
// Supports multiple backends:
// 1. llama.cpp server (auto-started as child process) — DEFAULT
// 2. Ollama (if running)
// 3. Any OpenAI-compatible local server
//
// The pipeline routes ALL inference through the local model.
// The cognitive scaffolding IS the intelligence — not the model size.

import { execFile, spawn, ChildProcess } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface LocalModel {
  filename: string;
  path: string;
  sizeBytes: number;
  sizeMB: number;
  detected: boolean;
}

export interface InferenceConfig {
  backend: 'llama-cpp' | 'ollama' | 'openai-compatible';
  modelPath: string;
  contextSize: number;
  threads: number;
  gpuLayers: number;
  port: number;
  host: string;
  temperature: number;
  topP: number;
  repeatPenalty: number;
}

const DEFAULT_CONFIG: InferenceConfig = {
  backend: 'llama-cpp',
  modelPath: '',
  contextSize: 4096,
  threads: 4,
  gpuLayers: 0,
  port: 8081,
  host: '127.0.0.1',
  temperature: 0.7,
  topP: 0.9,
  repeatPenalty: 1.1,
};

export class LocalInferenceEngine {
  private config: InferenceConfig;
  private serverProcess: ChildProcess | null = null;
  private isServerRunning: boolean = false;
  private modelsDir: string;
  private availableModels: LocalModel[] = [];
  private activeModel: LocalModel | null = null;

  constructor(modelsDir?: string, config?: Partial<InferenceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelsDir = modelsDir || join(process.cwd(), 'models');

    // Ensure models directory exists
    if (!existsSync(this.modelsDir)) {
      require('fs').mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  // ─── Model Discovery ───

  /** Scan models/ directory for GGUF files */
  discoverModels(): LocalModel[] {
    this.availableModels = [];

    if (!existsSync(this.modelsDir)) return this.availableModels;

    const files = readdirSync(this.modelsDir);
    for (const file of files) {
      if (file.endsWith('.gguf')) {
        const fullPath = join(this.modelsDir, file);
        const stats = statSync(fullPath);
        this.availableModels.push({
          filename: file,
          path: fullPath,
          sizeBytes: stats.size,
          sizeMB: Math.round(stats.size / (1024 * 1024)),
          detected: true,
        });
      }
    }

    // Sort by size (smallest first — small models are the point!)
    this.availableModels.sort((a, b) => a.sizeBytes - b.sizeBytes);

    return this.availableModels;
  }

  /** Auto-select the first available GGUF model */
  autoSelectModel(): LocalModel | null {
    const models = this.discoverModels();
    if (models.length === 0) return null;

    // Prefer small models (1-3B) as that's the AetherOS thesis
    // Q4_K_M quantizations are ideal
    const smallModel = models.find(m =>
      m.filename.toLowerCase().includes('1.1b') ||
      m.filename.toLowerCase().includes('1.2b') ||
      m.filename.toLowerCase().includes('1.5b') ||
      m.filename.toLowerCase().includes('2.7b') ||
      m.filename.toLowerCase().includes('3b')
    );

    this.activeModel = smallModel || models[0];
    this.config.modelPath = this.activeModel.path;

    return this.activeModel;
  }

  getAvailableModels(): LocalModel[] {
    return this.availableModels;
  }

  getActiveModel(): LocalModel | null {
    return this.activeModel;
  }

  // ─── llama.cpp Server Management ───

  /** Find the llama.cpp server binary */
  private findLlamaCppBinary(): string | null {
    const searchPaths = [
      join(process.cwd(), 'bin', 'llama-server'),
      join(process.cwd(), 'bin', 'llama-cpp-server'),
      join(process.cwd(), 'bin', 'server'),
      '/usr/local/bin/llama-server',
      '/usr/bin/llama-server',
      '/usr/local/bin/llama.cpp-server',
      join(process.cwd(), 'llama.cpp', 'llama-server'),
      join(process.cwd(), 'llama.cpp', 'server'),
    ];

    for (const p of searchPaths) {
      if (existsSync(p)) return p;
    }

    // Also check for the older 'main' binary name
    const altPaths = [
      join(process.cwd(), 'bin', 'main'),
      '/usr/local/bin/llama',
      '/usr/bin/llama',
    ];
    for (const p of altPaths) {
      if (existsSync(p)) return p;
    }

    return null;
  }

  /** Check if Ollama is running */
  private async isOllamaRunning(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags', {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Start the local inference server */
  async startServer(modelPath?: string): Promise<{ success: boolean; message: string; backend: string }> {
    const model = modelPath
      ? this.availableModels.find(m => m.path === modelPath) || { path: modelPath, filename: basename(modelPath) }
      : this.activeModel;

    if (!model && this.availableModels.length === 0) {
      return {
        success: false,
        message: 'No GGUF model found. Drop a .gguf file in the models/ directory.',
        backend: 'none',
      };
    }

    const targetModel = model || this.autoSelectModel();
    if (!targetModel) {
      return { success: false, message: 'No model selected.', backend: 'none' };
    }

    this.activeModel = targetModel as LocalModel;
    this.config.modelPath = (targetModel as LocalModel).path || (targetModel as any).path;

    // Try Ollama first (easiest setup)
    if (await this.isOllamaRunning()) {
      this.config.backend = 'ollama';
      this.isServerRunning = true;
      return {
        success: true,
        message: `Connected to Ollama with ${targetModel.filename}`,
        backend: 'ollama',
      };
    }

    // Try llama.cpp server
    const llamaBinary = this.findLlamaCppBinary();
    if (llamaBinary) {
      return this.startLlamaCppServer(llamaBinary);
    }

    // Check if there's already an OpenAI-compatible server running
    try {
      const response = await fetch(`http://${this.config.host}:${this.config.port}/v1/models`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        this.config.backend = 'openai-compatible';
        this.isServerRunning = true;
        return {
          success: true,
          message: `Connected to existing server at ${this.config.host}:${this.config.port}`,
          backend: 'openai-compatible',
        };
      }
    } catch {
      // No server running
    }

    return {
      success: false,
      message: `No inference backend found. Install one of:\n` +
        `  1. llama.cpp (copy 'llama-server' binary to bin/)\n` +
        `  2. Ollama (install and start with: ollama serve)\n` +
        `  3. Any OpenAI-compatible server on port ${this.config.port}\n\n` +
        `Then drop a GGUF model in models/ and restart.`,
      backend: 'none',
    };
  }

  /** Start llama.cpp as a child process */
  private async startLlamaCppServer(binaryPath: string): Promise<{ success: boolean; message: string; backend: string }> {
    if (!this.config.modelPath || !existsSync(this.config.modelPath)) {
      return { success: false, message: `Model not found: ${this.config.modelPath}`, backend: 'none' };
    }

    const args = [
      '-m', this.config.modelPath,
      '-c', String(this.config.contextSize),
      '-t', String(this.config.threads),
      '-ngl', String(this.config.gpuLayers),
      '--host', this.config.host,
      '--port', String(this.config.port),
      '--temp', String(this.config.temperature),
      '--top-p', String(this.config.topP),
      '--repeat-penalty', String(this.config.repeatPenalty),
      '-np', // No prompt — wait for API calls
    ];

    try {
      this.serverProcess = spawn(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      this.serverProcess.on('error', (err) => {
        console.error('[AetherOS] llama.cpp server error:', err.message);
        this.isServerRunning = false;
      });

      this.serverProcess.on('exit', (code) => {
        console.log(`[AetherOS] llama.cpp server exited with code ${code}`);
        this.isServerRunning = false;
      });

      // Wait for server to be ready
      const ready = await this.waitForServer(30000);

      if (ready) {
        this.config.backend = 'llama-cpp';
        this.isServerRunning = true;
        return {
          success: true,
          message: `llama.cpp server started with ${this.activeModel?.filename} on port ${this.config.port}`,
          backend: 'llama-cpp',
        };
      } else {
        return {
          success: false,
          message: 'llama.cpp server failed to start within 30s timeout',
          backend: 'none',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to start llama.cpp: ${error instanceof Error ? error.message : 'Unknown error'}`,
        backend: 'none',
      };
    }
  }

  /** Wait for inference server to respond */
  private async waitForServer(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const response = await fetch(`http://${this.config.host}:${this.config.port}/v1/models`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) return true;
      } catch {
        // Server not ready yet
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }

  /** Stop the inference server */
  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 1000));
      if (this.serverProcess.killed === false) {
        this.serverProcess.kill('SIGKILL');
      }
      this.serverProcess = null;
    }
    this.isServerRunning = false;
  }

  // ─── Inference ───

  /** Run inference through the local model — the core call the pipeline uses */
  async complete(prompt: string, systemPrompt?: string, temperature?: number): Promise<string> {
    if (!this.isServerRunning) {
      // Try auto-starting
      const result = await this.startServer();
      if (!result.success) {
        return `[AetherOS] No inference backend available. ${result.message}`;
      }
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const baseUrl = this.config.backend === 'ollama'
        ? 'http://127.0.0.1:11434'
        : `http://${this.config.host}:${this.config.port}`;

      const endpoint = this.config.backend === 'ollama'
        ? `${baseUrl}/v1/chat/completions`
        : `${baseUrl}/v1/chat/completions`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.activeModel?.filename || 'default',
          messages,
          temperature: temperature || this.config.temperature,
          max_tokens: 1024,
          stream: false,
        }),
        signal: AbortSignal.timeout(60000), // 60s timeout for slow models
      });

      if (!response.ok) {
        const errorText = await response.text();
        return `[AetherOS] Inference error (${response.status}): ${errorText.substring(0, 200)}`;
      }

      const data = await response.json();

      // OpenAI-compatible response format
      const content = data.choices?.[0]?.message?.content;
      if (content) return content.trim();

      // Ollama native format fallback
      if (data.message?.content) return data.message.content.trim();

      return `[AetherOS] Unexpected response format: ${JSON.stringify(data).substring(0, 200)}`;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return '[AetherOS] Inference timeout (60s). The model may be too slow — try a smaller GGUF.';
      }
      return `[AetherOS] Inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // ─── Status ───

  isRunning(): boolean {
    return this.isServerRunning;
  }

  getConfig(): InferenceConfig {
    return { ...this.config };
  }

  getBackend(): string {
    return this.config.backend;
  }

  getStatus(): {
    running: boolean;
    backend: string;
    model: string | null;
    modelSize: string;
    contextSize: number;
    port: number;
    availableModels: number;
  } {
    return {
      running: this.isServerRunning,
      backend: this.config.backend,
      model: this.activeModel?.filename || null,
      modelSize: this.activeModel ? `${this.activeModel.sizeMB}MB` : 'N/A',
      contextSize: this.config.contextSize,
      port: this.config.port,
      availableModels: this.availableModels.length,
    };
  }
}
