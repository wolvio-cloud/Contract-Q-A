# Contract Q&A Demo

## Environment Variables

- `OPENAI_API_KEY` – embeddings (`text-embedding-3-large`)
- `ANTHROPIC_API_KEY` – QA generation (`claude-sonnet-4-5` / `claude-opus-4-5`)
- `COHERE_API_KEY` – reranking (`rerank-v3.5`)
- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` – service-role key for indexing + QA persistence

## Indexing CLI

Run indexing for all contracts:

```bash
node --experimental-strip-types scripts/index-contracts.ts
```

Run retrieval benchmark:

```bash
node --experimental-strip-types scripts/test-retrieval.ts
```

Run QA streaming benchmark:

```bash
node --experimental-strip-types scripts/test-qa-stream.ts
```
