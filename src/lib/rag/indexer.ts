import crypto from "node:crypto";
import { chunkContract, naiveTokenChunk } from "./chunker.ts";
import { embedTexts } from "./embeddings.ts";
import { summarizeContract } from "./summarizer.ts";
import type { ChunkDraft, ContractRecord, EmbeddedChunk } from "./types.ts";
import { logger } from "../logger.ts";
import { hasSupabaseConfig, supabase } from "../supabase/service.ts";

export interface IndexResult {
  contractId: string;
  chunkCount: number;
  embeddingCostUsd: number;
}

function hashChunk(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function buildSummaryChunk(contract: ContractRecord, text: string, chunkIndex: number): ChunkDraft {
  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  return {
    contract_id: contract.id,
    contract_code: contract.contract_code,
    contract_type: contract.contract_type,
    chunk_kind: "summary",
    clause_reference: "Summary",
    section_title: "Contract Summary",
    page_number: 1,
    chunk_text: text,
    token_count: tokenCount,
    chunk_index: chunkIndex,
    content_hash: hashChunk(`${contract.id}:summary:${text}`),
  };
}

export async function indexContract(contract: ContractRecord): Promise<{ result: IndexResult; sample: { clauseAware: string[]; naive: string[] } }> {
  // TODO(qa-phase-1): Replace fallback token counter with js-tiktoken once shared tokenizer module is introduced.
  const chunks = chunkContract(contract);
  const summary = await summarizeContract(contract.raw_text);
  const allChunks = [...chunks, buildSummaryChunk(contract, summary, chunks.length)];

  const { vectors, costUsd } = await embedTexts(allChunks.map((item) => item.chunk_text));
  const embedded: EmbeddedChunk[] = allChunks.map((chunk, index) => ({ ...chunk, embedding: vectors[index] }));

  if (hasSupabaseConfig && supabase) {
    const payload = embedded.map((chunk) => ({
      contract_id: chunk.contract_id,
      chunk_kind: chunk.chunk_kind,
      clause_reference: chunk.clause_reference,
      section_title: chunk.section_title,
      page_number: chunk.page_number,
      chunk_text: chunk.chunk_text,
      token_count: chunk.token_count,
      chunk_index: chunk.chunk_index,
      embedding: chunk.embedding,
      content_hash: chunk.content_hash,
    }));

    const { error } = await supabase.from("contract_chunks").upsert(payload, { onConflict: "contract_id,content_hash" });
    if (error) {
      throw error;
    }
  }

  logger.info({
    operation: "rag.index.contract",
    contract_id: contract.id,
    chunks_generated: allChunks.length,
    embedding_cost_usd: Number(costUsd.toFixed(8)),
  });

  return {
    result: {
      contractId: contract.id,
      chunkCount: allChunks.length,
      embeddingCostUsd: costUsd,
    },
    sample: {
      clauseAware: chunks.slice(0, 3).map((item) => item.chunk_text.slice(0, 220)),
      naive: naiveTokenChunk(contract.raw_text, 220).slice(0, 3),
    },
  };
}

export async function indexContracts(contracts: ContractRecord[]): Promise<{
  results: IndexResult[];
  histogram: Record<string, number>;
  totalCostUsd: number;
  sampleComparison: { contractCode: string; clauseAware: string[]; naive: string[] }[];
}> {
  const results: IndexResult[] = [];
  const allTokenCounts: number[] = [];
  const sampleComparison: { contractCode: string; clauseAware: string[]; naive: string[] }[] = [];

  for (const contract of contracts) {
    const indexed = await indexContract(contract);
    results.push(indexed.result);
    sampleComparison.push({
      contractCode: contract.contract_code,
      clauseAware: indexed.sample.clauseAware,
      naive: indexed.sample.naive,
    });

    const chunks = chunkContract(contract);
    allTokenCounts.push(...chunks.map((chunk) => chunk.token_count));
  }

  const histogramBuckets = [0, 100, 200, 400, 800, 1200, Number.POSITIVE_INFINITY];
  const histogram: Record<string, number> = {};

  for (let i = 0; i < histogramBuckets.length - 1; i += 1) {
    const low = histogramBuckets[i];
    const high = histogramBuckets[i + 1];
    const key = high === Number.POSITIVE_INFINITY ? `${low}+` : `${low}-${high}`;
    histogram[key] = allTokenCounts.filter((count) => count >= low && count < high).length;
  }

  return {
    results,
    histogram,
    totalCostUsd: results.reduce((sum, item) => sum + item.embeddingCostUsd, 0),
    sampleComparison,
  };
}
