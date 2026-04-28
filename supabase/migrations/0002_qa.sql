-- Enable pgvector if not already
CREATE EXTENSION IF NOT EXISTS vector;

-- Contract chunks for RAG
CREATE TABLE contract_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  chunk_kind TEXT NOT NULL CHECK (chunk_kind IN ('clause', 'summary')),
  clause_reference TEXT,
  section_title TEXT,
  page_number INT,
  chunk_text TEXT NOT NULL,
  token_count INT NOT NULL,
  chunk_index INT NOT NULL,
  embedding vector(3072),
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX idx_chunks_embedding ON contract_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chunks_contract ON contract_chunks(contract_id);
CREATE INDEX idx_chunks_kind ON contract_chunks(chunk_kind);
CREATE UNIQUE INDEX idx_chunks_contract_hash ON contract_chunks(contract_id, content_hash);

-- Q&A conversations (for history / debugging / replay)
CREATE TABLE qa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE qa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES qa_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  retrieved_chunk_ids UUID[] DEFAULT ARRAY[]::UUID[],
  citations JSONB,
  input_tokens INT,
  output_tokens INT,
  cost_usd NUMERIC(10,6),
  duration_ms INT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qa_msgs_conversation ON qa_messages(conversation_id, created_at);

-- RPC for vector similarity search with metadata filters
CREATE OR REPLACE FUNCTION match_contract_chunks(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 12,
  filter_contract_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  contract_id UUID,
  chunk_kind TEXT,
  clause_reference TEXT,
  section_title TEXT,
  page_number INT,
  chunk_text TEXT,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    cc.id,
    cc.contract_id,
    cc.chunk_kind,
    cc.clause_reference,
    cc.section_title,
    cc.page_number,
    cc.chunk_text,
    1 - (cc.embedding <=> query_embedding) AS similarity
  FROM contract_chunks cc
  JOIN contracts c ON c.id = cc.contract_id
  WHERE 1 - (cc.embedding <=> query_embedding) > match_threshold
    AND (filter_contract_types IS NULL OR c.contract_type = ANY(filter_contract_types))
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RLS
ALTER TABLE contract_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role all access" ON contract_chunks FOR ALL TO service_role USING (true);
CREATE POLICY "service role all access" ON qa_conversations FOR ALL TO service_role USING (true);
CREATE POLICY "service role all access" ON qa_messages FOR ALL TO service_role USING (true);
