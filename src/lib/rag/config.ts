export const RAG_CONFIG = {
  retrieval: {
    candidateCount: 20,
    rerankTopN: 8,
    matchThreshold: 0.4,
    offTopicTopSimilarityThreshold: 0.12,
  },
  generation: {
    maxTokens: 1800,
    costCapUsd: 0.1,
    maxContextChars: 11_000,
  },
} as const;
