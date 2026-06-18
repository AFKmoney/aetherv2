// AetherOS Semantic Memory Graph
// Port of aether-engine's graph.rs — TF-IDF based semantic memory with edge expansion

import { TfidfVectorizer } from './tfidf';
import type { MemoryNode, MemoryEdge, ScoredNode, GraphAddRequest } from './types';

export class SemanticMemoryGraph {
  private nodes: Map<string, MemoryNode> = new Map();
  private adjacency: Map<string, Array<{ neighborId: string; weight: number }>> = new Map();
  private vectorizer: TfidfVectorizer = new TfidfVectorizer();
  private topK: number = 5;

  // Add or replace a node in the graph
  add(request: GraphAddRequest): MemoryNode {
    const id = request.id || `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Remove old node if it exists
    if (this.nodes.has(id)) {
      this.remove(id);
    }

    // Add to vectorizer corpus
    this.vectorizer.addDocument(request.text);

    // Compute vector
    const vector = this.vectorizer.vectorize(request.text);

    const node: MemoryNode = {
      id,
      text: request.text,
      category: request.category || 'fact',
      score: 0.0,
      vector,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.nodes.set(id, node);

    // Recompute edges for this node (and affected neighbors)
    this.recomputeEdges(id);

    return node;
  }

  // Remove a node from the graph
  remove(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove from vectorizer
    this.vectorizer.removeDocument(node.text);

    // Remove node
    this.nodes.delete(id);
    this.adjacency.delete(id);

    // Remove from all neighbor adjacency lists
    for (const [, neighbors] of this.adjacency) {
      const filtered = neighbors.filter(n => n.neighborId !== id);
      this.adjacency.set(id, filtered);
    }

    return true;
  }

  // Direct TF-IDF cosine similarity search
  search(query: string, topN: number = 8): ScoredNode[] {
    const queryVec = this.vectorizer.vectorize(query);

    const scored: ScoredNode[] = [];
    for (const [id, node] of this.nodes) {
      const score = TfidfVectorizer.cosineSimilarity(queryVec, node.vector);
      if (score > 0.0) {
        scored.push({ node, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN);
  }

  // Retrieve with 1-hop edge expansion (aether-engine's core retrieval)
  retrieve(query: string, topN: number = 8): ScoredNode[] {
    const directHits = this.search(query, topN);

    if (directHits.length === 0) return [];

    // Expand via edges — blended score
    const expanded = new Map<string, ScoredNode>();

    // Add direct hits
    for (const hit of directHits) {
      expanded.set(hit.node.id, hit);
    }

    // 1-hop expansion
    for (const hit of directHits) {
      const neighbors = this.adjacency.get(hit.node.id) || [];
      for (const edge of neighbors) {
        const neighborNode = this.nodes.get(edge.neighborId);
        if (!neighborNode) continue;

        const blended = hit.score * 0.5 + edge.weight * 0.5;
        const existing = expanded.get(edge.neighborId);

        if (!existing || blended > existing.score) {
          expanded.set(edge.neighborId, { node: neighborNode, score: blended });
        }
      }
    }

    return Array.from(expanded.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  // Recompute edges for a node based on cosine similarity to all other nodes
  private recomputeEdges(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const neighbors: Array<{ neighborId: string; weight: number }> = [];

    for (const [otherId, otherNode] of this.nodes) {
      if (otherId === nodeId) continue;

      const similarity = TfidfVectorizer.cosineSimilarity(node.vector, otherNode.vector);
      if (similarity > 0.1) {
        neighbors.push({ neighborId: otherId, weight: similarity });
      }

      // Also update the other node's adjacency if this is a new connection
      const otherNeighbors = this.adjacency.get(otherId) || [];
      const existingIdx = otherNeighbors.findIndex(n => n.neighborId === nodeId);
      if (similarity > 0.1) {
        if (existingIdx >= 0) {
          otherNeighbors[existingIdx].weight = similarity;
        } else {
          otherNeighbors.push({ neighborId: nodeId, weight: similarity });
        }
        // Keep only top-K
        otherNeighbors.sort((a, b) => b.weight - a.weight);
        this.adjacency.set(otherId, otherNeighbors.slice(0, this.topK));
      }
    }

    // Keep only top-K neighbors
    neighbors.sort((a, b) => b.weight - a.weight);
    this.adjacency.set(nodeId, neighbors.slice(0, this.topK));
  }

  // Get full graph data for visualization
  getGraph(): { nodes: MemoryNode[]; edges: MemoryEdge[] } {
    const nodes = Array.from(this.nodes.values()).map(n => ({
      ...n,
      vector: new Map() as Map<string, number>, // Don't send vectors to client
    }));

    const edges: MemoryEdge[] = [];
    const seen = new Set<string>();
    for (const [fromId, neighbors] of this.adjacency) {
      for (const { neighborId, weight } of neighbors) {
        const key = [fromId, neighborId].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ fromId, toId: neighborId, weight, label: 'related' });
        }
      }
    }

    return { nodes, edges };
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  getEdgeCount(): number {
    let count = 0;
    const seen = new Set<string>();
    for (const [fromId, neighbors] of this.adjacency) {
      for (const { neighborId } of neighbors) {
        const key = [fromId, neighborId].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          count++;
        }
      }
    }
    return count;
  }

  clear(): void {
    this.nodes.clear();
    this.adjacency.clear();
    this.vectorizer = new TfidfVectorizer();
  }
}
