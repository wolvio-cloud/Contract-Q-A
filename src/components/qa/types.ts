export interface QaCitation {
  marker: number;
  chunk_id: string;
  contract_id: string;
  contract_code: string;
  clause_ref: string | null;
  page: number;
  snippet: string;
}

export interface QaDoneData {
  text: string;
  citations: QaCitation[];
  correlation_id: string;
  cost_usd: number;
  retrieved_chunks: Array<{
    id: string;
    contract_code: string;
    clause_reference: string | null;
    page_number: number;
  }>;
}
