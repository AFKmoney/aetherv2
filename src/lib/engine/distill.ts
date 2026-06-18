// AetherOS Knowledge Distillation Store
// Port of aether-engine's distillation — Cache successful decomposition patterns

import { TfidfVectorizer } from './tfidf';
import type { DistillationPattern, SubQuestion } from './types';

export class DistillationStore {
  private patterns: Map<string, DistillationPattern> = new Map();
  private vectorizer: TfidfVectorizer = new TfidfVectorizer();

  // Store a successful decomposition pattern
  store(query: string, subQuestions: SubQuestion[]): void {
    const hash = this.hashQuery(query);
    this.vectorizer.addDocument(query);

    const existing = this.patterns.get(hash);
    if (existing) {
      existing.useCount++;
      // Update success rate with exponential moving average
      existing.successRate = existing.successRate * 0.9 + 1.0 * 0.1;
      existing.pattern = subQuestions;
      return;
    }

    this.patterns.set(hash, {
      id: `distill_${Date.now()}`,
      queryHash: hash,
      queryText: query,
      pattern: subQuestions,
      useCount: 1,
      successRate: 1.0,
    });
  }

  // Check for a reusable decomposition pattern (cosine > 0.80)
  lookup(query: string): DistillationPattern | null {
    const queryVec = this.vectorizer.vectorize(query);
    let bestPattern: DistillationPattern | null = null;
    let bestSimilarity = 0;

    for (const pattern of this.patterns.values()) {
      const patternVec = this.vectorizer.vectorize(pattern.queryText);
      const sim = TfidfVectorizer.cosineSimilarity(queryVec, patternVec);
      if (sim > bestSimilarity && sim >= 0.80) {
        bestSimilarity = sim;
        bestPattern = pattern;
      }
    }

    if (bestPattern) {
      bestPattern.useCount++;
    }

    return bestPattern;
  }

  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      hash = ((hash << 5) - hash) + query.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  getAll(): DistillationPattern[] {
    return Array.from(this.patterns.values());
  }

  clear(): void {
    this.patterns.clear();
    this.vectorizer = new TfidfVectorizer();
  }

  size(): number {
    return this.patterns.size;
  }
}
