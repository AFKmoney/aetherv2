// AetherOS Action Cache + Retrieval Cache
// Port of aether-engine's cache.rs — Two-tier lookup: O(1) hash + O(N) cosine

import { TfidfVectorizer } from './tfidf';

interface CacheEntry<T> {
  queryHash: string;
  queryVec: Map<string, number>;
  value: T;
  timestamp: number;
}

export class SemanticCache<T> {
  private entries: Map<string, CacheEntry<T>> = new Map();
  private vectorizer: TfidfVectorizer = new TfidfVectorizer();
  private threshold: number;
  private maxEntries: number;

  constructor(threshold: number = 0.95, maxEntries: number = 1000) {
    this.threshold = threshold;
    this.maxEntries = maxEntries;
  }

  // Two-tier lookup: exact hash then semantic similarity
  get(query: string): { value: T; similarity: number } | null {
    const hash = this.hashString(query);

    // Fast path: O(1) exact hash
    const exact = this.entries.get(hash);
    if (exact) {
      return { value: exact.value, similarity: 1.0 };
    }

    // Slow path: O(N) cosine scan
    const queryVec = this.vectorizer.vectorize(query);
    let bestEntry: CacheEntry<T> | null = null;
    let bestSimilarity = 0;

    for (const entry of this.entries.values()) {
      const sim = TfidfVectorizer.cosineSimilarity(queryVec, entry.queryVec);
      if (sim > bestSimilarity && sim >= this.threshold) {
        bestSimilarity = sim;
        bestEntry = entry;
      }
    }

    if (bestEntry) {
      return { value: bestEntry.value, similarity: bestSimilarity };
    }

    return null;
  }

  put(query: string, value: T): void {
    // Evict oldest if at capacity
    if (this.entries.size >= this.maxEntries) {
      const oldest = Array.from(this.entries.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.entries.delete(oldest[0]);
    }

    const hash = this.hashString(query);
    this.vectorizer.addDocument(query);
    const queryVec = this.vectorizer.vectorize(query);

    this.entries.set(hash, {
      queryHash: hash,
      queryVec,
      value,
      timestamp: Date.now(),
    });
  }

  private hashString(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit int
    }
    return hash.toString(36);
  }

  clear(): void {
    this.entries.clear();
    this.vectorizer = new TfidfVectorizer();
  }

  size(): number {
    return this.entries.size;
  }
}

// Two separate cache instances as in aether-engine
export class DualCache {
  actionCache: SemanticCache<string>;      // threshold 0.95
  retrievalCache: SemanticCache<string>;   // threshold 0.92

  constructor() {
    this.actionCache = new SemanticCache<string>(0.95);
    this.retrievalCache = new SemanticCache<string>(0.92);
  }

  clear(): void {
    this.actionCache.clear();
    this.retrievalCache.clear();
  }
}
