// AetherOS TF-IDF Vectorizer + Cosine Similarity
// Pure TypeScript port of aether-engine's tfidf.rs
// Zero external ML dependencies

export class TfidfVectorizer {
  private vocabulary: Map<string, number> = new Map(); // term -> index
  private documentFrequency: Map<string, number> = new Map(); // term -> df
  private documentCount: number = 0;
  private idfCache: Map<string, number> = new Map();

  // Tokenize text into terms
  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  // Compute TF (term frequency) for a document
  private computeTf(terms: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    let maxCount = 0;
    for (const term of terms) {
      const count = (tf.get(term) || 0) + 1;
      tf.set(term, count);
      if (count > maxCount) maxCount = count;
    }
    // Normalize by max count (same as aether-engine)
    if (maxCount > 0) {
      for (const [term, count] of tf) {
        tf.set(term, count / maxCount);
      }
    }
    return tf;
  }

  // Add a document to the corpus
  addDocument(text: string): void {
    const terms = this.tokenize(text);
    this.documentCount++;

    // Update document frequency
    const uniqueTerms = new Set(terms);
    for (const term of uniqueTerms) {
      this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
    }

    // Invalidate IDF cache
    this.idfCache.clear();
  }

  // Remove a document from the corpus
  removeDocument(text: string): void {
    const terms = this.tokenize(text);
    this.documentCount = Math.max(0, this.documentCount - 1);

    const uniqueTerms = new Set(terms);
    for (const term of uniqueTerms) {
      const df = this.documentFrequency.get(term) || 0;
      if (df <= 1) {
        this.documentFrequency.delete(term);
      } else {
        this.documentFrequency.set(term, df - 1);
      }
    }

    this.idfCache.clear();
  }

  // Compute IDF (inverse document frequency) — sklearn-style smoothing
  private getIdf(term: string): number {
    if (this.idfCache.has(term)) {
      return this.idfCache.get(term)!;
    }
    const df = this.documentFrequency.get(term) || 0;
    // IDF(t) = ln((1 + N) / (1 + df(t))) + 1  — sklearn smoothing
    const idf = Math.log((1 + this.documentCount) / (1 + df)) + 1;
    this.idfCache.set(term, idf);
    return idf;
  }

  // Compute TF-IDF vector for a document (sparse representation)
  vectorize(text: string): Map<string, number> {
    const terms = this.tokenize(text);
    const tf = this.computeTf(terms);
    const vector = new Map<string, number>();

    for (const [term, tfValue] of tf) {
      const idf = this.getIdf(term);
      vector.set(term, tfValue * idf);
    }

    // L2 normalize
    const norm = Math.sqrt(
      Array.from(vector.values()).reduce((sum, v) => sum + v * v, 0)
    );
    if (norm > 0) {
      for (const [term, value] of vector) {
        vector.set(term, value / norm);
      }
    }

    return vector;
  }

  // Cosine similarity between two sparse vectors — O(min(|a|, |b|))
  static cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    // Iterate over the smaller vector for efficiency
    const [smaller, larger] = a.size < b.size ? [a, b] : [b, a];

    let dotProduct = 0;
    for (const [term, value] of smaller) {
      const otherValue = larger.get(term);
      if (otherValue !== undefined) {
        dotProduct += value * otherValue;
      }
    }

    // Vectors are already L2-normalized, so cosine = dot product
    return dotProduct;
  }

  getDocumentCount(): number {
    return this.documentCount;
  }

  getVocabularySize(): number {
    return this.documentFrequency.size;
  }
}

// Utility: split text into sentences
export function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}
