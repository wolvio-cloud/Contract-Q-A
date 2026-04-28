import { env } from "../env.ts";
import { logger } from "../logger.ts";

export interface RerankableChunk {
  id: string;
  contract_id: string;
  contract_code: string;
  contract_type: string;
  chunk_text: string;
  clause_reference: string | null;
  section_title: string | null;
  page_number: number;
  similarity: number;
}

export interface RerankResult {
  chunks: RerankableChunk[];
  usedFallback: boolean;
}

function tokenize(input: string): Set<string> {
  return new Set(input.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function lexicalScore(question: string, text: string): number {
  const q = tokenize(question);
  const t = tokenize(text);
  if (q.size === 0 || t.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of q) {
    if (t.has(token)) {
      overlap += 1;
    }
  }

  return overlap / q.size;
}

function deterministicSort(a: RerankableChunk, b: RerankableChunk): number {
  if (b.similarity !== a.similarity) {
    return b.similarity - a.similarity;
  }
  return a.id.localeCompare(b.id);
}

export async function rerank(
  question: string,
  candidates: RerankableChunk[],
  options: { topN: number; timeoutMs?: number },
): Promise<RerankResult> {
  const timeoutMs = options.timeoutMs ?? 2_000;

  if (!env.COHERE_API_KEY) {
    const fallback = [...candidates]
      .map((chunk) => ({ ...chunk, similarity: (chunk.similarity * 0.65) + (lexicalScore(question, chunk.chunk_text) * 0.35) }))
      .sort(deterministicSort)
      .slice(0, options.topN);

    logger.warn({ operation: "rag.rerank.fallback", reason: "cohere-key-missing", top_n: options.topN });
    return { chunks: fallback, usedFallback: true };
  }

  try {
    const mod = await import("cohere-ai");
    const client = mod.CohereClient ? new mod.CohereClient({ token: env.COHERE_API_KEY }) : new mod.default({ token: env.COHERE_API_KEY });

    const responsePromise = client.rerank({
      model: "rerank-v3.5",
      query: question,
      documents: candidates.map((item) => item.chunk_text),
      topN: options.topN,
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("rerank-timeout")), timeoutMs);
    });

    const response = (await Promise.race([responsePromise, timeoutPromise])) as {
      results: Array<{ index: number; relevanceScore?: number; relevance_score?: number }>;
    };

    const reranked = response.results
      .map((result) => {
        const score = result.relevanceScore ?? result.relevance_score ?? 0;
        const original = candidates[result.index];
        return { ...original, similarity: score };
      })
      .sort(deterministicSort)
      .slice(0, options.topN);

    return { chunks: reranked, usedFallback: false };
  } catch (error) {
    logger.warn({ operation: "rag.rerank.fallback", reason: "cohere-error-or-timeout", error: String(error) });
    const fallback = [...candidates]
      .map((chunk) => ({ ...chunk, similarity: (chunk.similarity * 0.65) + (lexicalScore(question, chunk.chunk_text) * 0.35) }))
      .sort(deterministicSort)
      .slice(0, options.topN);
    return { chunks: fallback, usedFallback: true };
  }
}
