// AetherOS Asymmetric Tensor Dueling (ATD) Verification
// Port of aether-engine's atd.rs — Dual-graph validation: likelihood vs entropy

import type { ATDResult } from './types';

export function verify(response: string, query: string): ATDResult {
  const likelihood = computeLikelihood(response, query);
  const entropy = computeEntropy(response);
  const collisionDelta = likelihood - entropy;

  const repetitionRatio = computeRepetitionRatio(response);

  let validated = true;
  let recommendation: ATDResult['recommendation'] = 'Accept';

  // Same validation gates as aether-engine
  if (collisionDelta <= 0 || entropy > 0.65 || repetitionRatio > 0.30 || likelihood < 0.3) {
    validated = false;

    // Determine recommendation based on failure mode
    if (repetitionRatio > 0.30) {
      recommendation = 'RetryWithRephrasedPrompt'; // Model is looping
    } else if (entropy > 0.65 && likelihood < 0.3) {
      recommendation = 'FallBackToSimpleShot'; // Model is confused
    } else {
      recommendation = 'RetryWithLowerTemperature'; // Standard retry
    }
  }

  return {
    validated,
    likelihood,
    entropy,
    collisionDelta,
    recommendation,
  };
}

// Graph A (The Instinct) — Likelihood estimation
function computeLikelihood(response: string, query: string): number {
  const relevance = computeRelevance(response, query);
  const lengthScore = computeLengthScore(response);
  return 0.6 * relevance + 0.4 * lengthScore;
}

// Fraction of query keywords appearing in response
function computeRelevance(response: string, query: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (queryTerms.length === 0) return 0.5;

  const responseLower = response.toLowerCase();
  let matches = 0;
  for (const term of queryTerms) {
    if (responseLower.includes(term)) matches++;
  }
  return matches / queryTerms.length;
}

// Sweet spot ~50 words, degrades for <10 or >500
function computeLengthScore(response: string): number {
  const wordCount = response.split(/\s+/).length;
  if (wordCount < 10) return wordCount / 10 * 0.5;
  if (wordCount <= 100) return 0.8 + (wordCount / 100) * 0.2;
  if (wordCount <= 500) return 1.0 - ((wordCount - 100) / 400) * 0.3;
  return 0.7 - Math.min(0.4, (wordCount - 500) / 1000);
}

// Graph B (The Verifier) — Structural entropy
function computeEntropy(response: string): number {
  const vocabDiversity = computeVocabDiversity(response);
  const repetitionRatio = computeRepetitionRatio(response);
  const sentenceVariance = computeSentenceVariance(response);

  return 0.4 * (1 - vocabDiversity) + 0.4 * repetitionRatio + 0.2 * sentenceVariance;
}

// Unique words / total words
function computeVocabDiversity(response: string): number {
  const words = response.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;
  const unique = new Set(words);
  return unique.size / words.length;
}

// Fraction of bigrams appearing more than once
function computeRepetitionRatio(response: string): number {
  const words = response.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return 0;

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }

  const counts = new Map<string, number>();
  for (const bg of bigrams) {
    counts.set(bg, (counts.get(bg) || 0) + 1);
  }

  const repeatedBigrams = Array.from(counts.values()).filter(c => c > 1).length;
  return repeatedBigrams / bigrams.length;
}

// Variance in sentence lengths (normalized)
function computeSentenceVariance(response: string): number {
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 2) return 0;

  const lengths = sentences.map(s => s.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;

  // Normalize to [0, 1] range
  return Math.min(1, variance / (mean * mean));
}

// Compute adjusted temperature based on ATD recommendation
export function adjustTemperature(currentTemp: number, recommendation: ATDResult['recommendation']): number {
  switch (recommendation) {
    case 'RetryWithLowerTemperature':
      return currentTemp * 0.6;
    case 'RetryWithRephrasedPrompt':
      return currentTemp * 0.8;
    case 'FallBackToSimpleShot':
      return 0.3;
    default:
      return currentTemp;
  }
}
