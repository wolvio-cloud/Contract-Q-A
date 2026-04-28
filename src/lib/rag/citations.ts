import type { RetrievalChunk } from "./retriever.ts";

export interface StructuredCitation {
  marker: number;
  chunk_id: string;
  contract_id: string;
  contract_code: string;
  clause_ref: string | null;
  page: number;
  snippet: string;
}

export function extractCitationMarkers(text: string, chunks: RetrievalChunk[]): StructuredCitation[] {
  const matches = [...text.matchAll(/\[(\d+)\]/g)];
  const seen = new Set<number>();
  const citations: StructuredCitation[] = [];

  for (const match of matches) {
    const marker = Number(match[1]);
    if (!Number.isFinite(marker) || marker <= 0 || seen.has(marker)) {
      continue;
    }

    const chunk = chunks[marker - 1];
    if (!chunk) {
      continue;
    }

    seen.add(marker);
    citations.push({
      marker,
      chunk_id: chunk.id,
      contract_id: chunk.contract_id,
      contract_code: chunk.contract_code,
      clause_ref: chunk.clause_reference,
      page: chunk.page_number,
      snippet: chunk.chunk_text.slice(0, 320),
    });
  }

  return citations.sort((a, b) => a.marker - b.marker);
}
