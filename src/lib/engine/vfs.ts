// AetherOS — Persistent VFS (Virtual File System)
// Stores files in localStorage with a tree structure
// The agent can read/write files, and users can upload/manage them

export interface VFSFile {
  id: string;
  name: string;
  path: string;
  content: string;
  type: 'file' | 'directory';
  mimeType?: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

const VFS_STORAGE_KEY = 'aetheros-vfs';

export class VirtualFileSystem {
  private files: Map<string, VFSFile> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  // ─── CRUD ───

  writeFile(path: string, content: string, mimeType?: string): VFSFile {
    const normalizedPath = this.normalizePath(path);
    const existing = this.getFile(normalizedPath);

    const file: VFSFile = {
      id: existing?.id || `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: normalizedPath.split('/').pop() || 'untitled',
      path: normalizedPath,
      content,
      type: 'file',
      mimeType: mimeType || this.guessMimeType(normalizedPath),
      size: new TextEncoder().encode(content).length,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    this.files.set(normalizedPath, file);
    this.ensureDirectories(normalizedPath);
    this.save();
    this.notify();
    return file;
  }

  readFile(path: string): VFSFile | null {
    return this.files.get(this.normalizePath(path)) || null;
  }

  deleteFile(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    // Delete file and all children if directory
    let deleted = false;
    for (const key of this.files.keys()) {
      if (key === normalizedPath || key.startsWith(normalizedPath + '/')) {
        this.files.delete(key);
        deleted = true;
      }
    }
    if (deleted) {
      this.save();
      this.notify();
    }
    return deleted;
  }

  createDirectory(path: string): VFSFile {
    const normalizedPath = this.normalizePath(path);
    const dir: VFSFile = {
      id: `dir_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: normalizedPath.split('/').filter(Boolean).pop() || 'root',
      path: normalizedPath,
      content: '',
      type: 'directory',
      size: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.files.set(normalizedPath, dir);
    this.save();
    this.notify();
    return dir;
  }

  // ─── Tree Operations ───

  listDirectory(path: string): VFSFile[] {
    const normalizedPath = this.normalizePath(path);
    const children: VFSFile[] = [];

    for (const [key, file] of this.files) {
      if (file.type === 'directory' && key === normalizedPath) continue;
      const parentDir = key.substring(0, key.lastIndexOf('/')) || '/';
      if (parentDir === normalizedPath) {
        children.push(file);
      }
    }

    // Sort: directories first, then alphabetically
    return children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  getTree(): VFSNode {
    const root: VFSNode = { name: '/', path: '/', type: 'directory', children: [] };

    for (const file of this.files.values()) {
      if (file.path === '/') continue;
      const parts = file.path.split('/').filter(Boolean);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const partPath = '/' + parts.slice(0, i + 1).join('/');
        let child = current.children.find(c => c.path === partPath);

        if (!child) {
          child = {
            name: parts[i],
            path: partPath,
            type: i === parts.length - 1 ? file.type : 'directory',
            children: [],
            file: i === parts.length - 1 ? file : undefined,
          };
          current.children.push(child);
        }

        current = child;
      }
    }

    // Sort children
    const sortNodes = (nodes: VFSNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(root.children);

    return root;
  }

  getAllFiles(): VFSFile[] {
    return Array.from(this.files.values());
  }

  search(query: string): VFSFile[] {
    const lower = query.toLowerCase();
    return Array.from(this.files.values()).filter(
      f => f.type === 'file' && (f.name.toLowerCase().includes(lower) || f.content.toLowerCase().includes(lower))
    );
  }

  // ─── Persistence ───

  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(VFS_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as VFSFile[];
        for (const file of data) {
          this.files.set(file.path, file);
        }
      }
    } catch {
      // Corrupted data, start fresh
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    try {
      const data = Array.from(this.files.values());
      localStorage.setItem(VFS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full, clear oldest
      console.warn('[VFS] localStorage full, clearing old files');
    }
  }

  clear(): void {
    this.files.clear();
    this.save();
    this.notify();
  }

  // ─── Observers ───

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  // ─── Helpers ───

  private normalizePath(path: string): string {
    return '/' + path.split('/').filter(Boolean).join('/');
  }

  private ensureDirectories(filePath: string): void {
    const parts = filePath.split('/').filter(Boolean);
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = '/' + parts.slice(0, i + 1).join('/');
      if (!this.files.has(dirPath)) {
        this.createDirectory(dirPath);
      }
    }
  }

  private guessMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'ts': 'text/typescript', 'tsx': 'text/typescript', 'js': 'text/javascript',
      'jsx': 'text/javascript', 'py': 'text/x-python', 'rs': 'text/rust',
      'json': 'application/json', 'md': 'text/markdown', 'txt': 'text/plain',
      'html': 'text/html', 'css': 'text/css', 'yaml': 'text/yaml', 'yml': 'text/yaml',
      'toml': 'text/toml', 'sh': 'text/x-shellscript',
    };
    return mimeMap[ext || ''] || 'text/plain';
  }
}

export interface VFSNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: VFSNode[];
  file?: VFSFile;
}
