// AetherOS Context Compressor
// Port of aether-engine's compress.rs — Three-strategy pipeline for 10:1 compression

import { TfidfVectorizer, splitSentences } from './tfidf';
import type { ScoredNode } from './types';

export function compress(retrieved: ScoredNode[], query: string, budget: number = 6000): string {
  if (retrieved.length === 0) return '';

  // Strategy 1: Nodes already ranked by TF-IDF from graph retrieval
  // Strategy 2: Sentence-level extraction — only sentences with query-term overlap
  const queryTerms = new Set(query.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const selectedSentences: Array<{ text: string; score: number }> = [];

  for (const { node, score } of retrieved) {
    const sentences = splitSentences(node.text);

    if (score > 0.5) {
      // High-scoring nodes keep ALL sentences
      for (const sentence of sentences) {
        selectedSentences.push({ text: sentence, score });
      }
    } else {
      // Lower-scoring nodes: only keep sentences with query-term overlap
      for (const sentence of sentences) {
        const sentenceTerms = new Set(sentence.toLowerCase().split(/\s+/));
        let overlap = 0;
        for (const term of queryTerms) {
          if (sentenceTerms.has(term)) overlap++;
        }
        if (overlap > 0) {
          selectedSentences.push({ text: sentence, score: score + overlap * 0.1 });
        }
      }
    }
  }

  // Strategy 3: Deduplication — remove sentences with cosine > 0.85 (near-identical)
  const deduplicated: Array<{ text: string; score: number }> = [];
  for (const item of selectedSentences) {
    const itemVec = simpleVectorize(item.text);
    let isDuplicate = false;
    for (const existing of deduplicated) {
      const existingVec = simpleVectorize(existing.text);
      if (TfidfVectorizer.cosineSimilarity(itemVec, existingVec) > 0.85) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      deduplicated.push(item);
    }
  }

  // Sort by score and fill budget
  deduplicated.sort((a, b) => b.score - a.score);

  let result = '';
  for (const item of deduplicated) {
    if (result.length + item.text.length + 1 > budget) break;
    result += (result ? '\n' : '') + item.text;
  }

  return result;
}

// Simple bag-of-words vectorizer for sentence-level dedup
function simpleVectorize(text: string): Map<string, number> {
  const terms = text.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const vec = new Map<string, number>();
  for (const term of terms) {
    vec.set(term, (vec.get(term) || 0) + 1);
  }
  // L2 normalize
  const norm = Math.sqrt(Array.from(vec.values()).reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (const [k, v] of vec) vec.set(k, v / norm);
  }
  return vec;
}
