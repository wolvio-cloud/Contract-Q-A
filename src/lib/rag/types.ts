export interface TextSpan {
  page: number;
  start: number;
  end: number;
}

export interface ContractRecord {
  id: string;
  contract_code: string;
  contract_type: string;
  raw_text: string;
  page_count: number;
  spans?: TextSpan[];
}

export interface ChunkDraft {
  contract_id: string;
  contract_code: string;
  contract_type: string;
  chunk_kind: "clause" | "summary";
  clause_reference: string | null;
  section_title: string | null;
  page_number: number;
  chunk_text: string;
  token_count: number;
  chunk_index: number;
  content_hash: string;
}

export interface EmbeddedChunk extends ChunkDraft {
  embedding: number[];
}
