import { env } from "../env.ts";
import { logger } from "../logger.ts";

const MODEL = "text-embedding-3-large";
const PRICE_PER_MILLION = 0.13;
const BATCH_SIZE = 100;
const MAX_CONCURRENT_BATCHES = 4;
const MAX_RETRIES = 3;

interface OpenAIEmbeddingClient {
  embeddings: {
    create(input: { model: string; input: string[] }): Promise<{
      data: Array<{ embedding: number[] }>;
      usage?: { prompt_tokens?: number };
    }>;
  };
}

async function getOpenAIClient(): Promise<OpenAIEmbeddingClient | null> {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const mod = await import("openai");
    const client = new mod.default({ apiKey: env.OPENAI_API_KEY }) as OpenAIEmbeddingClient;
    return client;
  } catch {
    return null;
  }
}

function estimateTokenCount(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

async function embedBatch(input: string[], client: OpenAIEmbeddingClient | null): Promise<{ vectors: number[][]; inputTokens: number }> {
  if (!client) {
    return {
      vectors: input.map(() => Array.from({ length: 3072 }, () => 0)),
      inputTokens: input.reduce((sum, item) => sum + estimateTokenCount(item), 0),
    };
  }

  let attempt = 0;
  const startedAt = Date.now();

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await client.embeddings.create({
        model: MODEL,
        input,
      });

      const inputTokens = response.usage?.prompt_tokens ?? input.reduce((sum, item) => sum + estimateTokenCount(item), 0);
      const costUsd = (inputTokens / 1_000_000) * PRICE_PER_MILLION;

      logger.info({ operation: "rag.embed.batch", count: input.length, duration_ms: Date.now() - startedAt, cost_usd: Number(costUsd.toFixed(8)) });
      return { vectors: response.data.map((entry) => entry.embedding), inputTokens };
    } catch (error) {
      attempt += 1;
      const status = (error as { status?: number }).status;
      if (attempt > MAX_RETRIES || status !== 429) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  throw new Error("Embedding batch retries exhausted");
}

export async function embedTexts(input: string[]): Promise<{ vectors: number[][]; inputTokens: number; costUsd: number }> {
  const client = await getOpenAIClient();
  const chunks: string[][] = [];
  for (let i = 0; i < input.length; i += BATCH_SIZE) {
    chunks.push(input.slice(i, i + BATCH_SIZE));
  }

  const vectors: number[][] = [];
  let inputTokens = 0;

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_BATCHES) {
    const window = chunks.slice(i, i + MAX_CONCURRENT_BATCHES);
    const responses = await Promise.all(window.map((batch) => embedBatch(batch, client)));
    for (const response of responses) {
      vectors.push(...response.vectors);
      inputTokens += response.inputTokens;
    }
  }

  return { vectors, inputTokens, costUsd: (inputTokens / 1_000_000) * PRICE_PER_MILLION };
}
