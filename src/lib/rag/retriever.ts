import { logger } from "../logger.ts";
import { supabase } from "../supabase/service.ts";
import { embedTexts } from "./embeddings.ts";
import { classifyQuery } from "./query-classifier.ts";
import { rerank, type RerankableChunk } from "./reranker.ts";

export interface RetrievalChunk extends RerankableChunk {}

export interface RetrievalResult {
  context: string;
  chunks: RetrievalChunk[];
  vectorOrdered: RetrievalChunk[];
  classification: ReturnType<typeof classifyQuery>;
  correlationId: string;
  durationMs: number;
}

export interface RetrievalOptions {
  corpus?: RetrievalChunk[];
  matchThreshold?: number;
  matchCount?: number;
}

function newCorrelationId(): string {
  return `rag_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

function lexicalSimilarity(question: string, chunk: string): number {
  const q = new Set(tokenize(question));
  const c = new Set(tokenize(chunk));

  if (q.size === 0 || c.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of q) {
    if (c.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(q.size, 1);
}

function deterministicSort(a: RetrievalChunk, b: RetrievalChunk): number {
  if (b.similarity !== a.similarity) {
    return b.similarity - a.similarity;
  }
  return a.id.localeCompare(b.id);
}

function buildCitationContext(chunks: RetrievalChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const sourceNo = index + 1;
      const clause = chunk.clause_reference ?? "Unlabeled clause";
      const title = chunk.section_title ? `, ${chunk.section_title}` : "";
      return `[${sourceNo}] (Contract ${chunk.contract_code}, ${clause}, p.${chunk.page_number}${title}):\n"${chunk.chunk_text.slice(0, 700)}"`;
    })
    .join("\n\n");
}

async function vectorSearchViaSupabase(
  queryEmbedding: number[],
  contractTypes: string[] | null,
  threshold: number,
  count: number,
): Promise<RetrievalChunk[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await (supabase as never).rpc("match_contract_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: count,
    filter_contract_types: contractTypes,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    contract_id: String(row.contract_id),
    contract_code: String((row.contract_code as string | undefined) ?? "UNKNOWN"),
    contract_type: String((row.contract_type as string | undefined) ?? "Unknown"),
    chunk_text: String(row.chunk_text),
    clause_reference: row.clause_reference ? String(row.clause_reference) : null,
    section_title: row.section_title ? String(row.section_title) : null,
    page_number: Number(row.page_number ?? 1),
    similarity: Number(row.similarity ?? 0),
  }));
}

function searchFromCorpus(
  question: string,
  corpus: RetrievalChunk[],
  contractTypes: string[] | null,
  threshold: number,
  count: number,
): RetrievalChunk[] {
  const filtered = contractTypes?.length
    ? corpus.filter((chunk) => contractTypes.includes(chunk.contract_type))
    : corpus;

  return filtered
    .map((chunk) => ({ ...chunk, similarity: lexicalSimilarity(question, chunk.chunk_text) }))
    .filter((chunk) => chunk.similarity >= threshold)
    .sort(deterministicSort)
    .slice(0, count);
}

export async function retrieve(question: string, options: RetrievalOptions = {}): Promise<RetrievalResult> {
  const startedAt = Date.now();
  const correlationId = newCorrelationId();

  const classification = classifyQuery(question);
  logger.info({ operation: "rag.classify", question, classification, correlationId });

  const queryEmbedding = (await embedTexts([question])).vectors[0];
  const matchThreshold = options.matchThreshold ?? 0.4;
  const matchCount = options.matchCount ?? 20;

  let candidates: RetrievalChunk[] = [];

  if (options.corpus && options.corpus.length > 0) {
    candidates = searchFromCorpus(
      question,
      options.corpus,
      classification.suggested_contract_types,
      matchThreshold,
      matchCount,
    );
  } else {
    candidates = await vectorSearchViaSupabase(
      queryEmbedding,
      classification.suggested_contract_types,
      matchThreshold,
      matchCount,
    );
  }

  const vectorOrdered = [...candidates].sort(deterministicSort).slice(0, 8);
  const reranked = await rerank(question, candidates, { topN: 8, timeoutMs: 2_000 });

  if (reranked.usedFallback) {
    logger.warn({ operation: "rag.retrieve.fallback", correlationId, reason: "rerank-fallback" });
  }

  const durationMs = Date.now() - startedAt;
  const context = buildCitationContext(reranked.chunks);

  logger.info({
    operation: "rag.retrieve.done",
    correlationId,
    candidates_count: candidates.length,
    reranked_count: reranked.chunks.length,
    top_similarity: reranked.chunks[0]?.similarity ?? null,
    duration_ms: durationMs,
  });

  return {
    context,
    chunks: reranked.chunks,
    vectorOrdered,
    classification,
    correlationId,
    durationMs,
  };
}
